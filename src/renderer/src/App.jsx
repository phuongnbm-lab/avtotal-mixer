import { useState, useEffect, useCallback, useRef } from 'react'
import TitleBar from './components/TitleBar'
import FileListCard from './components/FileListCard'
import OutputCard from './components/OutputCard'
import QueueTable from './components/QueueTable'
import { ConfirmDialog } from './components/ConfirmDialog'
import LicenseDialog from './components/LicenseDialog'
import { useAppState } from './hooks/useAppState'
import { useRender } from './hooks/useRender'
import { playSound } from './sound'
import { secToHMS, basename } from './utils'
import { useLang } from './LangContext'

const AUDIO_EXTS = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg']
const VIDEO_EXTS = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v']

export default function App() {
  const [licenseState, setLicenseState] = useState(null) // null=loading, {ok,msg}=result
  const [dark, setDark] = useState(false)
  const [dialogConfig, setDialogConfig] = useState(null)
  const dialogResolveRef = useRef(null)

  useEffect(() => {
    window.api.license.machineId().then(mid =>
      window.api.license.verify(mid).then(result => {
        setLicenseState(result)
        window.api.app.splashDone?.()
      })
    )
  }, [])

  const {
    audioState, setAudioState,
    videoState, setVideoState,
    outputName, setOutputName,
    outputFolder, setOutputFolder,
    resolution, setResolution,
    musicFolder, setMusicFolder,
    clipFolder, setClipFolder,
    queue, setQueue,
    metadataPresets, setMetadataPresets,
    saveState, loaded
  } = useAppState()

  const { renderState, startRender, cancelRender } = useRender(queue, setQueue)

  // Intercept window close — hỏi confirm nếu có dữ liệu chưa lưu
  const isDirtyRef = useRef(false)
  const innerRef   = useRef(null)
  useEffect(() => {
    isDirtyRef.current =
      (audioState.files?.length > 0) ||
      (videoState.files?.length > 0) ||
      (queue.length > 0) ||
      !!musicFolder.enabled ||
      !!clipFolder.enabled
  }, [audioState.files, videoState.files, queue, musicFolder.enabled, clipFolder.enabled])

  useEffect(() => {
    window.api.win.onAskClose(async () => {
      if (!isDirtyRef.current) {
        window.api.win.forceClose()
        return
      }
      const action = await showDialog({
        title: '⚠️ Exit app?',
        message: 'You have unsaved data.\nExiting will lose all imported files and queue.',
        buttons: [
          { action: 'exit', label: 'Exit', color: '#e74c3c' },
          { action: 'cancel', label: 'Stay', color: '#5A3DF0' },
        ]
      })
      if (action === 'exit') window.api.win.forceClose()
    })
  }, [])

  // Ctrl+Q → exit
  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey && e.key.toLowerCase() === 'q') window.api.win.close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  // Auto-resize window to fit content when queue changes
  useEffect(() => {
    requestAnimationFrame(() => {
      if (!innerRef.current) return
      const contentH = innerRef.current.getBoundingClientRect().height
      const TITLEBAR = 46, PAD = 20, FOOTER = 22  // pad: 12t+8b, footer: 5t+11+6b
      const desired  = Math.round(contentH + TITLEBAR + PAD + FOOTER)
      const capped   = Math.min(desired, window.screen.availHeight - 60)
      const final    = Math.max(capped, 640)
      window.api.win?.setSize(final)
    })
  }, [queue.length, renderState.active])

  // Auto-save
  const saveRef = useRef(saveState)
  saveRef.current = saveState
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => {
      saveRef.current({ audioState, videoState, outputName, outputFolder, resolution, musicFolder, clipFolder, queue, dark, metadataPresets })
    }, 600)
    return () => clearTimeout(t)
  }, [audioState, videoState, outputName, outputFolder, resolution, musicFolder, clipFolder, queue, dark, loaded])

  function incrementName(name) {
    // Match trailing digits (with optional zero-padding), e.g. "C3"→"C4", "A01"→"A02"
    const m = name.match(/^(.*?)(\d+)$/)
    if (m) {
      const num = parseInt(m[2], 10) + 1
      const padded = String(num).padStart(m[2].length, '0')
      return m[1] + padded
    }
    return name + '2'
  }

  function showDialog(config) {
    return new Promise(resolve => {
      dialogResolveRef.current = resolve
      setDialogConfig(config)
    })
  }

  function handleDialogAction(action) {
    setDialogConfig(null)
    if (dialogResolveRef.current) {
      dialogResolveRef.current(action)
      dialogResolveRef.current = null
    }
  }

  async function autoRename(baseName, folder) {
    let i = 1
    while (true) {
      const candidate = `${baseName} (${String(i).padStart(2, '0')})`
      const exists = await window.api.fs.exists(folder.replace(/[/\\]+$/, '') + '\\' + candidate + '.mp4')
      if (!exists) return candidate
      i++
    }
  }

  async function buildJob() {
    const audioFiles = await resolveAudioFiles()
    const videoFiles = await resolveVideoFiles()
    if (!audioFiles.length) { alert('No audio files added.'); return null }
    if (!videoFiles.length) { alert('No video files added.'); return null }
    if (!outputName.trim()) { alert('Please enter an output file name.'); return null }
    if (!outputFolder.trim()) { alert('Please select an output folder.'); return null }

    let jobName = outputName.trim()
    const folder = outputFolder.trim()

    // Check trùng tên file trên disk
    const outPath = folder.replace(/[/\\]+$/, '') + '\\' + jobName + '.mp4'
    const existsOnDisk = await window.api.fs.exists(outPath)
    if (existsOnDisk) {
      playSound('Error.wav')
      const action = await showDialog({
        title: '⚠️ File already exists',
        message: `"${jobName}.mp4" already exists at:\n${folder}`,
        buttons: [
          { action: 'overwrite', label: 'Overwrite', color: '#e74c3c' },
          { action: 'rename',    label: 'Auto-rename', color: '#5A3DF0' },
          { action: 'cancel',    label: 'Cancel', color: '#888' },
        ]
      })
      if (action === 'cancel' || !action) return null
      if (action === 'rename') {
        jobName = await autoRename(jobName, folder)
        setOutputName(jobName)
      }
      // 'overwrite' → tiếp tục với tên cũ, ffmpeg sẽ ghi đè
    }

    // Check trùng tên với job đang có trong queue
    const dupInQueue = queue.some(j => j.name === jobName && j.folderPath === folder)
    if (dupInQueue) {
      playSound('Error.wav')
      const action = await showDialog({
        title: '⚠️ Duplicate name in Queue',
        message: `"${jobName}" already exists in the render queue.`,
        buttons: [
          { action: 'add',    label: 'Add anyway', color: '#18C9B7' },
          { action: 'cancel', label: 'Cancel', color: '#888' },
        ]
      })
      if (action === 'cancel' || !action) return null
    }

    const durationSeconds = await estimateDuration(audioFiles)
    return {
      _id: Date.now() + Math.random(),
      name: jobName,
      folderPath: folder,
      audioFiles,
      videoFiles,
      videoMutedFlags: videoFiles.map(f => {
        const vIdx = (videoState.files || []).indexOf(f)
        if (vIdx >= 0) return !!(videoState.mutedFlags || [])[vIdx]
        return basename(f).startsWith('~')
      }),
      scaleUp: videoState.scale !== false,
      resolution,
      exportList: !!audioState.exportList,
      audioOverlayEnabled: !!audioState.overlayEnabled,
      audioOverlayFile: audioState.overlayFile || '',
      sfxLoop: audioState.sfxLoop || { enabled: false, file: '', count: 1, sfxStart: 0, sfxEnd: 0 },
      overlayEnabled: !!videoState.overlayEnabled,
      overlayFile: videoState.overlayFile || '',
      introEnabled: !!videoState.introEnabled,
      introFile: videoState.introFile || '',
      introDuration: videoState.introDuration || '00:00:03',
      introScaleUp: videoState.introScale !== false,
      ctaSlots: [],
      metadataPresetId: null,
      progress: 'Pending',
      duration: secToHMS(durationSeconds)
    }
  }

  const resetAll = useCallback(async () => {
    const action = await showDialog({
      title: '🗑 Reset All',
      message: 'Remove all audio, video files and output name?\n(Output folder and resolution are kept.)',
      buttons: [
        { action: 'reset', label: 'Reset All', color: '#e74c3c' },
        { action: 'cancel', label: 'Cancel', color: '#888' },
      ]
    })
    if (action !== 'reset') return
    setAudioState({ files: [], loopCounts: [], shuffle: true, exportList: true, overlayEnabled: false, overlayFile: '', sfxLoop: { enabled: false, file: '', count: 1, sfxStart: 0, sfxEnd: 0 } })
    setVideoState({ files: [], mutedFlags: [], soloFlags: [], shuffle: true, scale: true, overlayEnabled: false, overlayFile: '', introEnabled: false, introFile: '', introDuration: '00:00:03', introScale: true })
    setOutputName('VideoMix')
    setMusicFolder({ enabled: false, folder: '', num: 0, subfolders: false })
    setClipFolder({ enabled: false, folder: '', num: 0, subfolders: false })
    setQueue([])
  }, [showDialog, setAudioState, setVideoState, setOutputName, setMusicFolder, setClipFolder, setQueue])

  const addToQueue = useCallback(async () => {
    const job = await buildJob()
    if (job) {
      setQueue(q => [...q, job])
      setOutputName(incrementName(job.name))
    }
  }, [audioState, videoState, outputName, outputFolder, resolution, musicFolder, clipFolder, queue, setQueue])

  const quickRender = useCallback(async () => {
    const job = await buildJob()
    if (job) {
      startRender([job])
      setOutputName(incrementName(job.name))
    }
  }, [audioState, videoState, outputName, outputFolder, resolution, musicFolder, clipFolder, queue, startRender])

  function resolveJobMetadata(job) {
    if (!job.metadataPresetId) return job
    const preset = (metadataPresets || []).find(p => p.id === job.metadataPresetId)
    if (!preset) return job
    const { title, description, hashtags, tags, category, language, rating } = preset
    return { ...job, metadata: { title, description, hashtags, tags, category, language, rating } }
  }

  async function resolveAudioFiles() {
    if (musicFolder.enabled && musicFolder.folder) {
      const all = await window.api.fs.listMedia({
        folder: musicFolder.folder,
        extensions: AUDIO_EXTS,
        includeSubfolders: musicFolder.subfolders
      })
      const exclude = new Set((audioState.files || []))
      const available = all.filter(f => !exclude.has(f))
      const n = musicFolder.num || 0
      if (n === 0) return available
      if (n <= available.length) {
        const shuffled = [...available].sort(() => Math.random() - 0.5)
        return shuffled.slice(0, n)
      }
      const extras = Array.from({ length: n - available.length }, () => available[Math.floor(Math.random() * available.length)])
      return [...available, ...extras]
    }
    const expanded = []
    const files = audioState.files || []
    const loops = audioState.loopCounts || []
    files.forEach((f, i) => {
      const count = loops[i] || 1
      for (let j = 0; j < count; j++) expanded.push(f)
    })
    return expanded
  }

  async function resolveVideoFiles() {
    let videos = [...(videoState.files || [])]
    const soloFlags = videoState.soloFlags || []
    if (soloFlags.some(Boolean)) {
      const soloVids = videos.filter((_, i) => soloFlags[i])
      videos = soloVids.slice(0, 1)
    }

    if (clipFolder.enabled && clipFolder.folder) {
      const all = await window.api.fs.listMedia({
        folder: clipFolder.folder,
        extensions: VIDEO_EXTS,
        includeSubfolders: clipFolder.subfolders
      })
      const exclude = new Set(videos)
      const available = all.filter(f => !exclude.has(f))
      const n = clipFolder.num || 0
      let sampled = available
      if (n > 0) {
        if (n < available.length) {
          sampled = [...available].sort(() => Math.random() - 0.5).slice(0, n)
        } else if (n > available.length) {
          const extras = Array.from({ length: n - available.length }, () => available[Math.floor(Math.random() * available.length)])
          sampled = [...available, ...extras]
        }
      }
      return [...videos, ...sampled]
    }
    return videos
  }

  async function estimateDuration(files) {
    let total = 0
    for (const f of files) {
      const d = await window.api.ffmpeg.duration(f).catch(() => 0)
      total += d
    }
    return total
  }

  if (licenseState === null) return <CheckingLicense />
  if (!licenseState.ok) return (
    <LicenseDialog
      errorMsg={licenseState.msg}
      onActivated={() => setLicenseState({ ok: true })}
    />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <TitleBar dark={dark} onToggleDark={() => setDark(d => !d)} licenseInfo={licenseState} />

      <ConfirmDialog config={dialogConfig} onAction={handleDialogAction} />

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 8px' }}>
        <div ref={innerRef}>
          {/* Media panels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, minHeight: 300, maxHeight: 420 }}>
            <FileListCard kind="audio" state={audioState} onChange={setAudioState} />
            <FileListCard kind="video" state={videoState} onChange={setVideoState} />
          </div>

          {/* Output card */}
          <OutputCard
            outputName={outputName} setOutputName={setOutputName}
            outputFolder={outputFolder} setOutputFolder={setOutputFolder}
            resolution={resolution} setResolution={setResolution}
            musicFolder={musicFolder} setMusicFolder={setMusicFolder}
            clipFolder={clipFolder} setClipFolder={setClipFolder}
            audioState={audioState} videoState={videoState}
            queue={queue} setQueue={setQueue}
            onAddToQueue={addToQueue}
            onQuickRender={quickRender}
            onResetAll={resetAll}
            renderActive={renderState.active}
          />

          {/* Queue */}
          <QueueTable
            queue={queue} setQueue={setQueue}
            renderState={renderState}
            onRenderAll={() => startRender(queue.map(resolveJobMetadata))}
            onRenderOne={(idx) => startRender([resolveJobMetadata(queue[idx])])}
            onCancel={cancelRender}
            dark={dark}
            metadataPresets={metadataPresets}
            setMetadataPresets={setMetadataPresets}
            isVip={licenseState?.vip === true}
          />
        </div>
      </div>

      {/* Footer — ngoài scroll, luôn nằm cuối window */}
      <div style={{ textAlign: 'right', color: 'var(--muted)', fontSize: 11, padding: '5px 18px 7px', flexShrink: 0 }}>
        v260527 · Bá Phương · 0904066020
      </div>
    </div>
  )
}

function CheckingLicense() {
  const { t } = useLang()
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)', fontSize: 14 }}>
      {t.checkingLicense}
    </div>
  )
}
