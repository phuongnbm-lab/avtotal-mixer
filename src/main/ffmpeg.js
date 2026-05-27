import { ipcMain } from 'electron'
import { spawn, spawnSync } from 'child_process'
import { existsSync, statSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join, dirname, extname, basename } from 'path'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'

const durationCache = new Map()

function findTool(name) {
  const ext = process.platform === 'win32' ? '.exe' : ''
  const appDir = process.env.APP_DIR || process.cwd()
  const candidates = [
    join(appDir, `${name}${ext}`),
    join(appDir, 'ffmpeg', 'bin', `${name}${ext}`),
    join(appDir, 'bin', `${name}${ext}`),
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return name
}

function runSync(args, opts = {}) {
  const cmd = args[0]
  const rest = args.slice(1)
  const tool = ['ffmpeg', 'ffprobe'].includes(cmd.toLowerCase()) ? findTool(cmd) : cmd
  const result = spawnSync(tool, rest, {
    encoding: 'utf8',
    windowsHide: true,
    ...opts
  })
  if (opts.check !== false && result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim()
    throw new Error(`FFmpeg error:\n${err}`)
  }
  return result
}

function durationCacheKey(filePath) {
  try {
    const st = statSync(filePath)
    return `${filePath}|${st.size}|${st.mtimeMs}`
  } catch {
    return `${filePath}|0|0`
  }
}

function safeDuration(filePath) {
  if (!filePath || !existsSync(filePath)) return 0

  const key = durationCacheKey(filePath)
  if (durationCache.has(key)) return durationCache.get(key)

  let dur = 0

  // Try ffprobe JSON
  try {
    const r = runSync([
      'ffprobe', '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,duration',
      '-print_format', 'json', filePath
    ], { check: false })
    const data = JSON.parse(r.stdout || '{}')
    dur = parseFloat((data.format || {}).duration) || 0
    if (!dur) {
      for (const s of (data.streams || [])) {
        const t = ['audio', 'video']
        if (t.includes((s.codec_type || '').toLowerCase())) {
          const sd = parseFloat(s.duration) || 0
          if (sd > dur) dur = sd
        }
      }
    }
  } catch {}

  if (dur > 0) {
    durationCache.set(key, dur)
    return dur
  }

  // Fallback: ffmpeg -i text parse
  try {
    const r = runSync(['ffmpeg', '-i', filePath], { check: false })
    const blob = (r.stderr || '') + '\n' + (r.stdout || '')
    const m = blob.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
    if (m) {
      dur = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3])
    }
  } catch {}

  if (dur > 0) durationCache.set(key, dur)
  return dur
}

function hasAudio(filePath) {
  try {
    const r = runSync([
      'ffprobe', '-v', 'error', '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', filePath
    ], { check: false })
    return !!(r.stdout || '').trim()
  } catch {
    const ext = extname(filePath).toLowerCase()
    return ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'].includes(ext)
  }
}

function detectGpuEncoder() {
  try {
    const r = spawnSync(findTool('ffmpeg'), [
      '-y', '-f', 'lavfi', '-i', 'color=c=black:size=64x64:duration=0.04:rate=25',
      '-c:v', 'h264_nvenc', '-preset', 'p4', '-pix_fmt', 'yuv420p', '-f', 'null', '-'
    ], { encoding: 'utf8', windowsHide: true, timeout: 12000 })
    if (r.status === 0) return { encoder: 'h264_nvenc', preset: 'p4' }
  } catch {}
  return { encoder: 'libx264', preset: 'veryfast' }
}

let gpuInfo = null
function getGpuInfo() {
  if (!gpuInfo) gpuInfo = detectGpuEncoder()
  return gpuInfo
}

function makeTempDir() {
  const dir = join(tmpdir(), 'avtotal_' + randomBytes(6).toString('hex'))
  mkdirSync(dir, { recursive: true })
  return dir
}

function writeConcatList(txtPath, files) {
  const lines = files.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n')
  writeFileSync(txtPath, lines, 'utf8')
}

function nextAvailablePath(folder, baseName, ext) {
  let candidate = join(folder, baseName + ext)
  if (!existsSync(candidate)) return candidate
  let i = 1
  while (true) {
    candidate = join(folder, `${baseName} (${String(i).padStart(2, '0')})${ext}`)
    if (!existsSync(candidate)) return candidate
    i++
  }
}

function secToHMS(s) {
  s = Math.max(0, Math.round(s))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function parseTimecode(val) {
  if (!val) return 0
  const s = String(val).trim().replace(',', '.')
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s)
  const parts = s.split(':').map(Number)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

function normalizeVideo(source, outVideo, scaleUp, w, h, fps, muteAudio, progressCb) {
  const { encoder, preset } = getGpuInfo()
  const srcDur = safeDuration(source)
  if (srcDur <= 0) throw new Error(`Cannot read video duration: ${source}`)

  let vf
  if (scaleUp) {
    vf = `scale=w='ceil(max(${w}/iw\\,${h}/ih)*1.07*iw/2)*2':h='ceil(max(${w}/iw\\,${h}/ih)*1.07*ih/2)*2',crop=${w}:${h}:0:0,setsar=1`
  } else {
    vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1`
  }
  vf += `,fps=${Math.round(fps)}`

  const srcHasAudio = hasAudio(source)
  let cmd

  if (muteAudio || !srcHasAudio) {
    cmd = [
      'ffmpeg', '-y', '-i', source,
      '-f', 'lavfi', '-t', srcDur.toFixed(6), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-filter_complex', `[0:v]${vf}[v]`,
      '-map', '[v]', '-map', '1:a:0',
      '-c:v', encoder, '-preset', preset, '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-shortest', '-movflags', '+faststart', outVideo
    ]
  } else {
    cmd = [
      'ffmpeg', '-y', '-i', source,
      '-vf', vf,
      '-c:v', encoder, '-preset', preset, '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-movflags', '+faststart', outVideo
    ]
  }
  runSync(cmd)
}

function applyOverlay(inputVideo, overlayFile, tempDir, w, h) {
  const ext = extname(overlayFile).toLowerCase()
  const out = join(tempDir, 'video_overlayed.mp4')
  const { encoder, preset } = getGpuInfo()

  if (ext === '.png') {
    runSync([
      'ffmpeg', '-y', '-i', inputVideo, '-loop', '1', '-i', overlayFile,
      '-filter_complex', '[1:v]format=rgba[ov];[0:v][ov]overlay=0:0:format=auto[v]',
      '-map', '[v]', '-map', '0:a?',
      '-c:v', encoder, '-preset', preset, '-pix_fmt', 'yuv420p',
      '-c:a', 'copy', '-shortest', out
    ])
  } else {
    const dur = safeDuration(inputVideo)
    runSync([
      'ffmpeg', '-y', '-i', inputVideo, '-stream_loop', '-1', '-i', overlayFile,
      '-filter_complex', `[1:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[ov];[0:v][ov]overlay=0:0:format=auto:shortest=1[v]`,
      '-map', '[v]', '-map', '0:a?',
      '-c:v', encoder, '-preset', preset, '-pix_fmt', 'yuv420p',
      '-c:a', 'copy', '-t', String(dur), out
    ])
  }
  return out
}

function applyIntro(baseVideo, introFile, introDuration, tempDir, w, h, fps) {
  if (!introFile) return { video: baseVideo, offset: 0 }
  const { encoder, preset } = getGpuInfo()
  const introNorm = join(tempDir, 'intro_norm.mp4')
  const ext = extname(introFile).toLowerCase()
  let introDur = 0

  // Intro always uses letterbox/pillarbox — never inherits Scale setting
  const vfFit = `fps=${Math.round(fps)},scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1`

  if (ext === '.png') {
    introDur = Math.max(0, parseTimecode(introDuration)) || 3
    runSync([
      'ffmpeg', '-y', '-loop', '1', '-i', introFile,
      '-f', 'lavfi', '-t', introDur.toFixed(6), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-filter_complex', `[0:v]${vfFit}[v]`,
      '-map', '[v]', '-map', '1:a:0',
      '-t', introDur.toFixed(6),
      '-c:v', encoder, '-preset', preset, '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-shortest', '-movflags', '+faststart', introNorm
    ])
  } else {
    introDur = safeDuration(introFile)
    normalizeVideo(introFile, introNorm, false, w, h, fps, false)
  }

  const concatTxt = join(tempDir, 'intro_concat.txt')
  writeConcatList(concatTxt, [introNorm, baseVideo])
  const out = join(tempDir, 'video_with_intro.mp4')
  runSync(['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', concatTxt, '-c', 'copy', out])
  return { video: out, offset: Math.max(0, introDur) }
}

// Áp dụng CTA overlay lên toàn bộ video (1 pass encode với NVENC/libx264).
// Không dùng cut-encode-copy vì gây audio click & video stutter tại seam.
// Timecode tuyệt đối: CTA tại 2p, 6p, 11p trong video 12p → itsoffset + enable=between(t,T,T+D)
function applyCTA(videoPath, ctaSlots, tempDir, w, h) {
  const { encoder, preset } = getGpuInfo()
  const videoDur = safeDuration(videoPath)

  // Parse & validate slots
  const slots = []
  for (const slot of ctaSlots) {
    const file = (slot.file || '').trim()
    if (!file || !existsSync(file)) continue
    const start = Math.max(0, parseTimecode(slot.timecode || '0'))
    if (start >= videoDur) continue
    const isPng = extname(file).toLowerCase() === '.png'
    const fileDur = isPng ? (videoDur - start) : safeDuration(file)
    if (!(fileDur > 0)) continue
    const end = Math.min(start + fileDur, videoDur)
    slots.push({ file, start, end, isPng })
  }
  if (!slots.length) return null

  const inputArgs = ['-i', videoPath]
  const filterParts = []
  let prevOut = '0:v'

  for (let j = 0; j < slots.length; j++) {
    const s = slots[j]
    const idx = j + 1
    const ctaDur = (s.end - s.start).toFixed(6)

    if (s.isPng) {
      inputArgs.push('-loop', '1', '-i', s.file)
      // format=rgba: giữ alpha channel qua scale, tránh bị convert sang yuv420p (mất trong suốt)
      filterParts.push(
        `[${idx}:v]format=rgba,scale=${w}:${h}[sc${idx}];` +
        `[${prevOut}][sc${idx}]overlay=0:0:eof_action=pass:enable='between(t,${s.start.toFixed(3)},${s.end.toFixed(3)})'[vo${idx}]`
      )
    } else {
      // Không dùng -itsoffset: một số MOV alpha có initial PTS ≠ 0 làm lệch timecode.
      // Thay bằng setpts=PTS-STARTPTS+T/TB (kỹ thuật từ bản Python):
      // normalize PTS về 0 trước, rồi shift đúng offset → frame 0 xuất hiện đúng tại t=T.
      inputArgs.push('-t', ctaDur, '-an', '-i', s.file)
      filterParts.push(
        `[${idx}:v]format=rgba,setpts=PTS-STARTPTS+${s.start.toFixed(6)}/TB,scale=${w}:${h}[sc${idx}];` +
        `[${prevOut}][sc${idx}]overlay=0:0:eof_action=pass:enable='between(t,${s.start.toFixed(3)},${s.end.toFixed(3)})'[vo${idx}]`
      )
    }
    prevOut = `vo${idx}`
  }

  // Pass 1: encode video overlay only (không map audio) → tránh hoàn toàn audio artifact
  // do filter_complex stall khi khởi tạo CTA stream gây pop/crackle
  const videoOnly = join(tempDir, 'video_cta_noaudio.mp4')
  runSync([
    'ffmpeg', '-y', ...inputArgs,
    '-filter_complex', filterParts.join(';'),
    '-map', `[${prevOut}]`, '-an',
    '-c:v', encoder, '-preset', preset, '-pix_fmt', 'yuv420p',
    videoOnly
  ])

  // Pass 2: mux lại audio gốc từ videoPath (copy nguyên, không decode/encode)
  const inHasAudio = hasAudio(videoPath)
  if (!inHasAudio) return videoOnly
  const out = join(tempDir, 'video_cta.mp4')
  runSync([
    'ffmpeg', '-y', '-i', videoOnly, '-i', videoPath,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'copy', '-shortest', out
  ])
  return out
}

/**
 * SFX Loop: đặt SFX N lần, phân bổ đều giữa A và B.
 * - SFX lần 1 bắt đầu tại A (sfxStart).
 * - SFX lần cuối kết thúc tại B (sfxEnd), tức bắt đầu tại B - sfxDur.
 * - Các SFX còn lại cách đều nhau: interval = (B - sfxDur - A) / (count - 1)
 *
 * VD: totalDur=6min, A=1:00, B=5:00, sfxDur=4s, count=3
 *   lastSfxStart = 5:00 - 4s = 4:56
 *   interval = (4:56 - 1:00) / 2 = 1:58
 *   → SFX tại 1:00, 2:58, 4:56  (kết thúc lần cuối đúng 5:00)
 *
 * Cấu trúc concat:
 *   [silence(A)] [sfx] [gap] [sfx] [gap] ... [sfx] [silence(totalDur - B)]
 */
function applySfxLoop(audioFile, sfxFile, count, totalDur, sfxStart, sfxEnd, tempDir) {
  if (!sfxFile || !existsSync(sfxFile) || count < 1 || totalDur <= 0) return audioFile

  const sfxDur = safeDuration(sfxFile)
  if (sfxDur <= 0) return audioFile

  let effectiveStart = Math.max(0, sfxStart || 0)                                // A: SFX lần 1 bắt đầu tại đây
  let effectiveEnd   = (sfxEnd && sfxEnd > 0) ? Math.min(sfxEnd, totalDur) : totalDur  // B: SFX lần cuối kết thúc tại đây

  // B không hợp lệ (B <= A hoặc zone quá hẹp cho 1 SFX) → bỏ B, dùng cuối track
  // Chỉ reset B, KHÔNG reset A — A luôn được tôn trọng
  if (effectiveEnd <= effectiveStart + sfxDur) {
    effectiveEnd = totalDur
  }
  // A quá lớn (> totalDur - sfxDur) → mới reset A
  if (effectiveStart > totalDur - sfxDur) {
    effectiveStart = 0
  }

  let lastSfxStart = effectiveEnd - sfxDur                     // SFX cuối bắt đầu tại đây
  if (lastSfxStart < effectiveStart) lastSfxStart = effectiveStart  // count=1 edge case

  // Khoảng cách giữa các điểm bắt đầu liên tiếp
  const interval = count > 1 ? (lastSfxStart - effectiveStart) / (count - 1) : 0
  const gapDur   = interval - sfxDur                           // silence giữa hai SFX

  const leadDur  = effectiveStart                              // silence trước SFX đầu
  const trailDur = totalDur - (effectiveStart + (count - 1) * interval + sfxDur)  // silence sau SFX cuối

  // Normalize SFX về 48kHz stereo
  const sfxNorm = join(tempDir, 'sfx_norm.mp3')
  runSync([
    'ffmpeg', '-y', '-i', sfxFile,
    '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    sfxNorm
  ])

  function makeSilence(filename, dur) {
    runSync([
      'ffmpeg', '-y', '-f', 'lavfi',
      '-t', dur.toFixed(6),
      '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-c:a', 'libmp3lame', '-b:a', '192k',
      filename
    ])
    return filename
  }

  const segments = []

  // 1. Silence trước SFX lần 1
  if (leadDur > 0.01) {
    segments.push(makeSilence(join(tempDir, 'sfx_lead.mp3'), leadDur))
  }

  // 2. [sfx] [gap] [sfx] [gap] ... [sfx]
  const gapFile = gapDur > 0.01
    ? makeSilence(join(tempDir, 'sfx_gap.mp3'), gapDur)
    : null

  for (let i = 0; i < count; i++) {
    segments.push(sfxNorm)
    if (i < count - 1 && gapFile) segments.push(gapFile)
  }

  // 3. Silence sau SFX cuối đến hết track
  if (trailDur > 0.01) {
    segments.push(makeSilence(join(tempDir, 'sfx_trail.mp3'), trailDur))
  }

  // Concat → sfx_track
  const concatTxt = join(tempDir, 'sfx_concat.txt')
  writeConcatList(concatTxt, segments)
  const sfxTrack = join(tempDir, 'sfx_track.mp3')
  runSync([
    'ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', concatTxt,
    '-t', totalDur.toFixed(6),
    '-c:a', 'libmp3lame', '-b:a', '192k',
    sfxTrack
  ])

  // Normalize audioFile lên 48000Hz để đồng bộ sample rate với sfxTrack
  const audioNorm48 = join(tempDir, 'audio_48k.mp3')
  runSync([
    'ffmpeg', '-y', '-i', audioFile,
    '-c:a', 'libmp3lame', '-b:a', '320k', '-ar', '48000', '-ac', '2',
    audioNorm48
  ])

  // Mix sfxTrack vào audio chính
  const mixedOut = join(tempDir, 'audio_with_sfx.mp3')
  runSync([
    'ffmpeg', '-y', '-i', audioNorm48, '-i', sfxTrack,
    '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=0:normalize=0:weights=\'1 1\'[aout]',
    '-map', '[aout]',
    '-c:a', 'libmp3lame', '-b:a', '320k',
    mixedOut
  ])

  // Đảm bảo output chính xác totalDur
  const finalOut = join(tempDir, 'audio_sfx_final.mp3')
  runSync([
    'ffmpeg', '-y', '-i', mixedOut,
    '-af', `apad=whole_dur=${totalDur.toFixed(3)}`,
    '-t', totalDur.toFixed(6),
    '-c:a', 'libmp3lame', '-b:a', '320k',
    finalOut
  ])

  return finalOut
}

// ── Windows File Metadata via IPropertyStore (Shell API) ─────────────────────
// Writes Title, Subtitle, Rating, Tags, Comments directly into MP4 via Windows API
const WIN_RATING = [0, 1, 25, 50, 75, 99]

function setWindowsMetadata(filePath, meta) {
  if (process.platform !== 'win32') return
  const { title = '', description = '', hashtags = '', tags = '', rating = 0 } = meta
  // System.Comment = description + hashtags combined
  const commentText = [description?.trim(), hashtags?.trim()].filter(Boolean).join('\n\n')
  const winRating = WIN_RATING[Math.min(5, Math.max(0, Number(rating)))] || 0

  const esc = s => (s || '').replace(/'/g, "''")  // escape single quotes for PowerShell

  const ps = `
$ErrorActionPreference='SilentlyContinue'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
[ComImport,Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IPS {
  int GetCount(out uint n); int GetAt(uint i, out PKey k);
  int GetValue(ref PKey k, out PropV v);
  int SetValue(ref PKey k, ref PropV v);
  int Commit();
}
[StructLayout(LayoutKind.Sequential,Pack=4)]
public struct PKey { public Guid g; public uint id; }
[StructLayout(LayoutKind.Explicit,Size=24)]
public struct PropV {
  [FieldOffset(0)] public ushort vt;
  [FieldOffset(8)] public IntPtr ptr;
  [FieldOffset(8)] public uint u4;
  [FieldOffset(8)] public uint cElems;
  [FieldOffset(16)] public IntPtr pElems;
}
public class WM {
  [DllImport("shell32.dll",CharSet=CharSet.Unicode,PreserveSig=false,EntryPoint="SHGetPropertyStoreFromParsingName")]
  static extern void GPS(string p,IntPtr b,uint f,[MarshalAs(UnmanagedType.LPStruct)]Guid g,out IPS s);
  static readonly Guid IID=new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
  static void Str(IPS s,Guid g,uint id,string v){
    if(string.IsNullOrEmpty(v))return;
    PKey k=new PKey{g=g,id=id};
    IntPtr p=Marshal.StringToCoTaskMemUni(v);
    PropV pv=new PropV{vt=31,ptr=p};
    try{s.SetValue(ref k,ref pv);}finally{Marshal.FreeCoTaskMem(p);}
  }
  static void U4(IPS s,Guid g,uint id,uint v){
    PKey k=new PKey{g=g,id=id};
    PropV pv=new PropV{vt=19,u4=v};
    s.SetValue(ref k,ref pv);
  }
  static void StrArr(IPS s,Guid g,uint id,string[] vals){
    if(vals==null||vals.Length==0)return;
    PKey k=new PKey{g=g,id=id};
    IntPtr[] ptrs=new IntPtr[vals.Length];
    for(int i=0;i<vals.Length;i++) ptrs[i]=Marshal.StringToCoTaskMemUni(vals[i]);
    IntPtr arr=Marshal.AllocCoTaskMem(ptrs.Length*IntPtr.Size);
    for(int i=0;i<ptrs.Length;i++) Marshal.WriteIntPtr(arr,i*IntPtr.Size,ptrs[i]);
    PropV pv=new PropV{vt=0x101F,cElems=(uint)vals.Length,pElems=arr};
    try{s.SetValue(ref k,ref pv);}
    finally{foreach(IntPtr p in ptrs)Marshal.FreeCoTaskMem(p);Marshal.FreeCoTaskMem(arr);}
  }
  public static void Write(string path,string title,string comment,uint rating,string keywords){
    IPS s; GPS(path,IntPtr.Zero,2,IID,out s);
    try{
      Str(s,new Guid("F29F85E0-4FF9-1068-AB91-08002B27B3D9"),2,title);
      Str(s,new Guid("F29F85E0-4FF9-1068-AB91-08002B27B3D9"),6,comment);
      if(rating>0) U4(s,new Guid("64440492-4C8B-11D1-8B70-080036B11A03"),9,rating);
      if(!string.IsNullOrEmpty(keywords)){
        string[] kws=keywords.Split(new char[]{',',';'},StringSplitOptions.RemoveEmptyEntries);
        for(int i=0;i<kws.Length;i++) kws[i]=kws[i].Trim();
        StrArr(s,new Guid("F29F85E0-4FF9-1068-AB91-08002B27B3D9"),5,kws);
      }
      s.Commit();
    }finally{Marshal.ReleaseComObject(s);}
  }
}
"@ -Language CSharp
[WM]::Write('${esc(filePath)}','${esc(title)}','${esc(commentText)}',${winRating},'${esc(tags)}')
`
  try {
    spawnSync('powershell', ['-NonInteractive', '-NoProfile', '-Command', ps], {
      encoding: 'utf8', windowsHide: true, timeout: 20000
    })
  } catch { /* best-effort — don't fail the render */ }
}

function exportJob(job, jobIndex, totalJobs, progressCb, cancelCheck) {
  const tempDir = makeTempDir()
  const { encoder, preset } = getGpuInfo()

  try {
    const resolution = job.resolution || 'FullHD'
    const RESOLUTIONS = {
      FullHD: { width: 1920, height: 1080, fps: 30 },
      '4K': { width: 3840, height: 2160, fps: 60 }
    }
    const { width: W, height: H, fps: FPS } = RESOLUTIONS[resolution] || RESOLUTIONS.FullHD

    const audioFiles = job.audioFiles || []
    const videoFiles = job.videoFiles || []
    const videoMutedFlags = job.videoMutedFlags || []
    const scaleUp = job.scaleUp !== false
    const outputFolder = job.folderPath
    const outputName = job.name || 'VideoMix'
    const ctaSlots = job.ctaSlots || []

    if (!audioFiles.length) throw new Error('No audio files selected.')
    if (!videoFiles.length) throw new Error('No video files selected.')
    mkdirSync(outputFolder, { recursive: true })

    const base = jobIndex / totalJobs
    const span = 1 / totalJobs
    const p = (frac, msg) => progressCb(Math.round((base + span * frac) * 100), msg)

    cancelCheck()

    // ── Build audio ───────────────────────────────────────────────────────────
    p(0.05, `Job ${jobIndex + 1}/${totalJobs}: Building audio track...`)
    const audioConcat = join(tempDir, 'audio_concat.txt')
    writeConcatList(audioConcat, audioFiles)
    const audioMerged = join(tempDir, 'audio_merged.mp3')
    runSync([
      'ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', audioConcat,
      '-vn', '-c:a', 'libmp3lame', '-b:a', '320k', audioMerged
    ])

    cancelCheck()

    // Check overlay audio
    let audio1 = audioMerged
    if (job.audioOverlayEnabled && job.audioOverlayFile && existsSync(job.audioOverlayFile)) {
      p(0.12, `Job ${jobIndex + 1}/${totalJobs}: Mixing overlay audio...`)
      const totalAudioDur = safeDuration(audioMerged)
      const loopedOverlay = join(tempDir, 'overlay_loop.mp3')
      runSync([
        'ffmpeg', '-y', '-stream_loop', '-1', '-i', job.audioOverlayFile,
        '-t', totalAudioDur.toFixed(6),
        '-vn', '-c:a', 'libmp3lame', '-b:a', '320k', loopedOverlay
      ])
      const mixedAudio = join(tempDir, 'audio_mixed.mp3')
      runSync([
        'ffmpeg', '-y', '-i', audioMerged, '-i', loopedOverlay,
        '-filter_complex', '[0:a]volume=1.0[a0];[1:a]volume=1.0[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0:weights=\'1 1\'[aout]',
        '-map', '[aout]',
        '-t', totalAudioDur.toFixed(6),
        '-c:a', 'libmp3lame', '-b:a', '320k', mixedAudio
      ])
      audio1 = mixedAudio
    }

    // ── SFX Loop ──────────────────────────────────────────────────────────────
    // Phân bổ đều file SFX N lần trong toàn bộ audio output
    // Đọc duration TRƯỚC khi apply để tránh ffprobe trả về giá trị sai từ file trung gian
    const totalAudioDuration = safeDuration(audio1)
    if (totalAudioDuration <= 0) throw new Error('Cannot read audio duration.')

    if (job.sfxLoop?.enabled && job.sfxLoop?.file && existsSync(job.sfxLoop.file)) {
      cancelCheck()
      p(0.14, `Job ${jobIndex + 1}/${totalJobs}: Applying SFX loop (×${job.sfxLoop.count})...`)
      const sfxCount = Math.max(1, Math.round(job.sfxLoop.count || 1))
      const sfxStartSec = parseTimecode(job.sfxLoop.sfxStart || 0)
      const sfxEndSec   = parseTimecode(job.sfxLoop.sfxEnd   || 0)
      audio1 = applySfxLoop(audio1, job.sfxLoop.file, sfxCount, totalAudioDuration, sfxStartSec, sfxEndSec, tempDir)
    }

    cancelCheck()

    // ── Export tracklist ──────────────────────────────────────────────────────
    if (job.exportList) {
      const lines = []
      let cursor = 0
      for (const f of audioFiles) {
        const dur = safeDuration(f)
        const tc = secToHMS(cursor)
        lines.push(`${tc} ${basename(f, extname(f))}`)
        cursor += dur
      }
      const listPath = join(outputFolder, `${outputName}_tracklist.txt`)
      writeFileSync(listPath, lines.join('\n'), 'utf8')
    }

    cancelCheck()

    // ── Normalize videos ──────────────────────────────────────────────────────
    const normalizedVideos = []
    const formatOkFlags = []
    const nClips = videoFiles.length

    for (let i = 0; i < nClips; i++) {
      cancelCheck()
      const source = videoFiles[i]
      const mute = !!(videoMutedFlags[i]) || basename(source).startsWith('~')
      const outVideo = join(tempDir, `vid_norm_${i}.mp4`)
      p(0.22 + (i / nClips) * 0.30, `Job ${jobIndex + 1}/${totalJobs}: Encoding clip ${i + 1}/${nClips}...`)
      normalizeVideo(source, outVideo, scaleUp, W, H, FPS, mute)
      normalizedVideos.push(outVideo)
      formatOkFlags.push(false)
    }

    cancelCheck()

    // ── Concat clips → 1 vòng loop ────────────────────────────────────────────
    cancelCheck()
    p(0.54, `Job ${jobIndex + 1}/${totalJobs}: Joining ${nClips} clip(s)...`)
    const videoConcat = join(tempDir, 'video_concat.txt')
    const video1 = join(tempDir, 'video_1.mp4')
    writeConcatList(videoConcat, normalizedVideos)
    runSync(['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', videoConcat, '-c', 'copy', video1])

    // ── Loop video ────────────────────────────────────────────────────────────
    cancelCheck()
    p(0.57, `Job ${jobIndex + 1}/${totalJobs}: Looping video to audio length...`)
    const video1Dur = safeDuration(video1)
    if (video1Dur <= 0) throw new Error('Cannot read normalized video duration.')
    const loopCount = Math.max(1, Math.floor(totalAudioDuration / video1Dur) + 2)
    const repeatTxt = join(tempDir, 'video_repeat.txt')
    writeConcatList(repeatTxt, Array(loopCount).fill(video1))
    let videoLoop = join(tempDir, 'video_loop.mp4')
    runSync(['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', repeatTxt, '-c', 'copy', videoLoop])

    // ── CTA overlays (apply SAU khi loop — timecode là vị trí tuyệt đối) ─────
    // VD: CTA tại 2p, 6p, 11p trong video 12p → phải apply lên video đã loop đủ dài
    if (ctaSlots && ctaSlots.length > 0) {
      cancelCheck()
      p(0.63, `Job ${jobIndex + 1}/${totalJobs}: Applying CTA overlays...`)
      const videoWithCTA = applyCTA(videoLoop, ctaSlots, tempDir, W, H)
      if (videoWithCTA) videoLoop = videoWithCTA
    }

    // ── Intro ─────────────────────────────────────────────────────────────────
    cancelCheck()
    let introOffset = 0
    if (job.introEnabled && job.introFile && existsSync(job.introFile)) {
      p(0.67, `Job ${jobIndex + 1}/${totalJobs}: Applying intro...`)
      const { video: withIntro, offset } = applyIntro(videoLoop, job.introFile, job.introDuration, tempDir, W, H, FPS)
      videoLoop = withIntro
      introOffset = offset
    }

    // ── Overlay ───────────────────────────────────────────────────────────────
    cancelCheck()
    if (job.overlayEnabled && job.overlayFile && existsSync(job.overlayFile)) {
      p(0.74, `Job ${jobIndex + 1}/${totalJobs}: Applying overlay...`)
      videoLoop = applyOverlay(videoLoop, job.overlayFile, tempDir, W, H)
    }

    // ── Mux final ─────────────────────────────────────────────────────────────
    cancelCheck()
    p(0.87, `Job ${jobIndex + 1}/${totalJobs}: Muxing final output...`)

    const finalMp4 = nextAvailablePath(outputFolder, outputName, '.mp4')

    // Build metadata args — portable MP4 atoms via ffmpeg
    // Tags, Rating, Subtitle → handled after mux via Windows IPropertyStore
    const metaArgs = []
    if (job.metadata) {
      const { title, description, hashtags, category, language } = job.metadata
      metaArgs.push('-map_metadata', '-1')
      if (title?.trim())    metaArgs.push('-metadata', `title=${title}`)
      // description + hashtags → comment atom (portable)
      const descFull = [description?.trim(), hashtags?.trim()].filter(Boolean).join('\n\n')
      if (descFull)         metaArgs.push('-metadata', `comment=${descFull}`)
      if (category?.trim()) metaArgs.push('-metadata', `genre=${category}`)
      if (language?.trim()) metaArgs.push('-metadata', `language=${language}`)
    }

    // When intro is present, delay audio list so it starts AFTER intro ends
    const outputDuration = totalAudioDuration + introOffset
    const delayMs = Math.round(introOffset * 1000)

    if (hasAudio(videoLoop)) {
      const audioFilter = introOffset > 0
        ? `[0:a]volume=1.0[a0];[1:a]adelay=${delayMs}|${delayMs},volume=1.0[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0:weights='1 1'[aout]`
        : `[0:a]volume=1.0[a0];[1:a]volume=1.0[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0:weights='1 1'[aout]`
      runSync([
        'ffmpeg', '-y',
        '-i', videoLoop, '-i', audio1,
        '-filter_complex', audioFilter,
        '-map', '0:v:0', '-map', '[aout]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-t', String(outputDuration),
        ...metaArgs,
        '-movflags', '+faststart', finalMp4
      ])
    } else {
      if (introOffset > 0) {
        runSync([
          'ffmpeg', '-y', '-i', videoLoop, '-i', audio1,
          '-filter_complex', `[1:a]adelay=${delayMs}|${delayMs}[aout]`,
          '-map', '0:v:0', '-map', '[aout]',
          '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
          '-t', String(outputDuration),
          ...metaArgs,
          '-movflags', '+faststart', finalMp4
        ])
      } else {
        runSync([
          'ffmpeg', '-y', '-i', videoLoop, '-i', audio1,
          '-map', '0:v:0', '-map', '1:a:0',
          '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
          '-t', String(totalAudioDuration),
          ...metaArgs,
          '-movflags', '+faststart', finalMp4
        ])
      }
    }

    // Write all metadata via Windows Shell IPropertyStore (after file is fully written)
    if (job.metadata) {
      setWindowsMetadata(finalMp4, job.metadata)
    }

    p(1.0, `Job ${jobIndex + 1}/${totalJobs}: Done ✓`)
    return finalMp4

  } finally {
    try { rmSync(tempDir, { recursive: true, force: true }) } catch {}
  }
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

const activeRenders = new Map()

export function setupFFmpegHandlers() {
  ipcMain.handle('ffmpeg:duration', (_, filePath) => {
    return safeDuration(filePath)
  })

  ipcMain.handle('ffmpeg:hasAudio', (_, filePath) => {
    return hasAudio(filePath)
  })

  ipcMain.handle('ffmpeg:detectGpu', () => {
    return getGpuInfo()
  })

  ipcMain.handle('ffmpeg:clearDurationCache', (_, filePath) => {
    if (filePath) {
      for (const [k] of durationCache) {
        if (k.startsWith(filePath + '|')) durationCache.delete(k)
      }
    } else {
      durationCache.clear()
    }
  })

  ipcMain.handle('ffmpeg:render', async (event, { jobs, renderId }) => {
    let cancelled = false
    activeRenders.set(renderId, { cancel: () => { cancelled = true } })

    const exportedFiles = []
    try {
      for (let i = 0; i < jobs.length; i++) {
        const result = exportJob(
          jobs[i],
          i,
          jobs.length,
          (pct, msg) => event.sender.send('ffmpeg:progress', { renderId, pct, msg }),
          () => { if (cancelled) throw new Error('CANCELLED') }
        )
        exportedFiles.push(result)
        event.sender.send('ffmpeg:jobDone', {
          renderId, jobIndex: i, total: jobs.length, file: result
        })
      }
      return { success: true, files: exportedFiles }
    } catch (err) {
      if (err.message === 'CANCELLED') return { success: false, cancelled: true }
      return { success: false, error: err.message }
    } finally {
      activeRenders.delete(renderId)
    }
  })

  ipcMain.on('ffmpeg:cancel', (_, renderId) => {
    const render = activeRenders.get(renderId)
    if (render) render.cancel()
  })
}
