import { useState, useCallback, useRef, useEffect } from 'react'
import { basename, stem, shortenMiddle, secToHMS, secToMMSS, parseTimecode, ext } from '../utils'
import Toggle from './Toggle'
import Btn from './Btn'
import { useLang } from '../LangContext'

const AUDIO_EXTS = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg']
const VIDEO_EXTS = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v']

const DEFAULT_STATE = {
  audio: { files: [], loopCounts: [], shuffle: true, exportList: true, overlayEnabled: false, overlayFile: '', sfxLoop: { enabled: false, file: '', count: 1, sfxStart: 0, sfxEnd: 0 } },
  video: { files: [], mutedFlags: [], soloFlags: [], shuffle: true, scale: true,
           overlayEnabled: false, overlayFile: '', introEnabled: false, introFile: '',
           introDuration: '00:00:03', introScale: true }
}

export default function FileListCard({ kind, state = DEFAULT_STATE[kind], onChange }) {
  const { t } = useLang()
  const isAudio = kind === 'audio'
  const accent = isAudio ? '#5A3DF0' : '#18C9B7'
  const accentSoft = isAudio ? 'var(--purple-soft)' : 'var(--teal-soft)'
  const exts = isAudio ? AUDIO_EXTS : VIDEO_EXTS
  const [selected, setSelected] = useState([])
  const [ctxMenu, setCtxMenu] = useState(null)
  const [draggingOver, setDraggingOver] = useState(false)
  const [durations, setDurations] = useState({})
  const listRef = useRef(null)
  const dragCounter = useRef(0)
  const dragSrcRef = useRef(null)
  const isDraggingRow = useRef(false)
  const [dragOverIdx, setDragOverIdx] = useState(null)

  const files = state.files || []
  const mutedFlags = state.mutedFlags || []
  const soloFlags = state.soloFlags || []
  const loopCounts = state.loopCounts || []

  // Load durations
  useEffect(() => {
    files.forEach(f => {
      if (!durations[f]) {
        window.api.ffmpeg.duration(f).then(d => {
          if (d > 0) setDurations(prev => ({ ...prev, [f]: d }))
        })
      }
    })
  }, [files])

  const totalDuration = files.reduce((sum, f, i) => {
    const d = durations[f] || 0
    const loops = isAudio ? (loopCounts[i] || 1) : 1
    return sum + d * loops
  }, 0)

  function update(patch) {
    onChange({ ...state, ...patch })
  }

  async function addFiles() {
    const paths = await window.api.dialog.openFiles({
      title: `Add ${isAudio ? t.audio : t.video} files`,
      filters: [{ name: isAudio ? t.audio : t.video, extensions: exts.map(e => e.slice(1)) }]
    })
    if (!paths.length) return
    const newFiles = paths.filter(p => !files.includes(p))
    if (isAudio) {
      update({ files: [...files, ...newFiles], loopCounts: [...loopCounts, ...newFiles.map(() => 1)] })
    } else {
      update({
        files: [...files, ...newFiles],
        mutedFlags: [...mutedFlags, ...newFiles.map(p => basename(p).startsWith('~'))],
        soloFlags: [...soloFlags, ...newFiles.map(() => false)]
      })
    }
  }

  function shuffle(arr, parallel = []) {
    const idx = [...arr.keys()]
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]]
    }
    return {
      result: idx.map(i => arr[i]),
      parallels: parallel.map(p => idx.map(i => p[i]))
    }
  }

  function randomizeNow() {
    const { result, parallels } = shuffle(
      files,
      isAudio ? [loopCounts] : [mutedFlags, soloFlags]
    )
    if (isAudio) update({ files: result, loopCounts: parallels[0] })
    else update({ files: result, mutedFlags: parallels[0], soloFlags: parallels[1] })
    setSelected([])
  }

  function handleDragEnter(e) {
    if (isDraggingRow.current) return
    e.preventDefault()
    dragCounter.current++
    setDraggingOver(true)
  }

  function handleDragLeave(e) {
    if (isDraggingRow.current) return
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDraggingOver(false)
  }

  function handleDrop(e) {
    if (isDraggingRow.current) return
    e.preventDefault()
    dragCounter.current = 0
    setDraggingOver(false)
    const paths = Array.from(e.dataTransfer.files)
      .map(f => f.path)
      .filter(p => p && exts.includes(ext(p).toLowerCase()))
      .filter(p => !files.includes(p))
    if (!paths.length) return
    if (isAudio) update({ files: [...files, ...paths], loopCounts: [...loopCounts, ...paths.map(() => 1)] })
    else update({ files: [...files, ...paths], mutedFlags: [...mutedFlags, ...paths.map(p => basename(p).startsWith('~'))], soloFlags: [...soloFlags, ...paths.map(() => false)] })
  }

  function reorderTo(from, to) {
    if (from === to || to === null) return
    const newFiles = [...files]
    const [f] = newFiles.splice(from, 1)
    newFiles.splice(to, 0, f)
    if (isAudio) {
      const newLoops = [...loopCounts]
      const [l] = newLoops.splice(from, 1)
      newLoops.splice(to, 0, l)
      update({ files: newFiles, loopCounts: newLoops })
    } else {
      const newMuted = [...mutedFlags]; const [m] = newMuted.splice(from, 1); newMuted.splice(to, 0, m)
      const newSolo = [...soloFlags];   const [s] = newSolo.splice(from, 1);   newSolo.splice(to, 0, s)
      update({ files: newFiles, mutedFlags: newMuted, soloFlags: newSolo })
    }
    setSelected([to])
  }

  function deleteSelected() {
    if (!selected.length) return
    const keep = new Set(selected)
    const newFiles = files.filter((_, i) => !keep.has(i))
    if (isAudio) {
      update({ files: newFiles, loopCounts: loopCounts.filter((_, i) => !keep.has(i)) })
    } else {
      update({
        files: newFiles,
        mutedFlags: mutedFlags.filter((_, i) => !keep.has(i)),
        soloFlags: soloFlags.filter((_, i) => !keep.has(i))
      })
    }
    setSelected([])
  }

  function moveUp() {
    if (!selected.length) return
    const sel = [...new Set(selected)].sort((a, b) => a - b)
    if (sel[0] === 0) return
    const newFiles = [...files]
    const newMuted = isAudio ? null : [...mutedFlags]
    const newSolo = isAudio ? null : [...soloFlags]
    const newLoops = isAudio ? [...loopCounts] : null
    sel.forEach(idx => {
      ;[newFiles[idx - 1], newFiles[idx]] = [newFiles[idx], newFiles[idx - 1]]
      if (newMuted) [newMuted[idx - 1], newMuted[idx]] = [newMuted[idx], newMuted[idx - 1]]
      if (newSolo) [newSolo[idx - 1], newSolo[idx]] = [newSolo[idx], newSolo[idx - 1]]
      if (newLoops) [newLoops[idx - 1], newLoops[idx]] = [newLoops[idx], newLoops[idx - 1]]
    })
    if (isAudio) update({ files: newFiles, loopCounts: newLoops })
    else update({ files: newFiles, mutedFlags: newMuted, soloFlags: newSolo })
    setSelected(sel.map(i => i - 1))
  }

  function moveDown() {
    if (!selected.length) return
    const sel = [...new Set(selected)].sort((a, b) => b - a)
    if (sel[0] === files.length - 1) return
    const newFiles = [...files]
    const newMuted = isAudio ? null : [...mutedFlags]
    const newSolo = isAudio ? null : [...soloFlags]
    const newLoops = isAudio ? [...loopCounts] : null
    sel.forEach(idx => {
      ;[newFiles[idx + 1], newFiles[idx]] = [newFiles[idx], newFiles[idx + 1]]
      if (newMuted) [newMuted[idx + 1], newMuted[idx]] = [newMuted[idx], newMuted[idx + 1]]
      if (newSolo) [newSolo[idx + 1], newSolo[idx]] = [newSolo[idx], newSolo[idx + 1]]
      if (newLoops) [newLoops[idx + 1], newLoops[idx]] = [newLoops[idx], newLoops[idx + 1]]
    })
    if (isAudio) update({ files: newFiles, loopCounts: newLoops })
    else update({ files: newFiles, mutedFlags: newMuted, soloFlags: newSolo })
    setSelected(sel.map(i => i + 1))
  }

  function handleCtxAction(action, idx) {
    setCtxMenu(null)
    if (action === 'play') window.api.shell.openPath(files[idx])
    if (action === 'folder') window.api.shell.openPath(files[idx].replace(/[\\/][^\\/]+$/, ''))
    if (action === 'delete') {
      const newFiles = files.filter((_, i) => i !== idx)
      if (isAudio) update({ files: newFiles, loopCounts: loopCounts.filter((_, i) => i !== idx) })
      else update({ files: newFiles, mutedFlags: mutedFlags.filter((_, i) => i !== idx), soloFlags: soloFlags.filter((_, i) => i !== idx) })
      setSelected(s => s.filter(i => i !== idx).map(i => i > idx ? i - 1 : i))
    }
    if (action === 'mute' && !isAudio) {
      const newMuted = [...mutedFlags]
      newMuted[idx] = !newMuted[idx]
      update({ mutedFlags: newMuted })
    }
    if (action === 'solo' && !isAudio) {
      const newSolo = [...soloFlags]
      newSolo[idx] = !newSolo[idx]
      update({ soloFlags: newSolo })
    }
    if (action === 'top') {
      const sel = selected.length ? [...new Set(selected)] : [idx]
      const selSet = new Set(sel)
      const selFiles = sel.map(i => files[i])
      const rest = files.filter((_, i) => !selSet.has(i))
      const newFiles = [...selFiles, ...rest]
      if (isAudio) update({ files: newFiles, loopCounts: [...sel.map(i => loopCounts[i] || 1), ...loopCounts.filter((_, i) => !selSet.has(i))] })
      else update({ files: newFiles, mutedFlags: [...sel.map(i => mutedFlags[i] || false), ...mutedFlags.filter((_, i) => !selSet.has(i))], soloFlags: [...sel.map(i => soloFlags[i] || false), ...soloFlags.filter((_, i) => !selSet.has(i))] })
      setSelected(sel.map((_, i) => i))
    }
    if (action === 'bottom') {
      const sel = selected.length ? [...new Set(selected)] : [idx]
      const selSet = new Set(sel)
      const selFiles = sel.map(i => files[i])
      const rest = files.filter((_, i) => !selSet.has(i))
      const newFiles = [...rest, ...selFiles]
      if (isAudio) update({ files: newFiles, loopCounts: [...loopCounts.filter((_, i) => !selSet.has(i)), ...sel.map(i => loopCounts[i] || 1)] })
      else update({ files: newFiles, mutedFlags: [...mutedFlags.filter((_, i) => !selSet.has(i)), ...sel.map(i => mutedFlags[i] || false)], soloFlags: [...soloFlags.filter((_, i) => !selSet.has(i)), ...sel.map(i => soloFlags[i] || false)] })
      setSelected(sel.map((_, i) => rest.length + i))
    }
    if (action === 'duplicate') {
      const i = idx
      const newFiles = [...files.slice(0, i + 1), files[i], ...files.slice(i + 1)]
      if (isAudio) update({ files: newFiles, loopCounts: [...loopCounts.slice(0, i + 1), loopCounts[i] || 1, ...loopCounts.slice(i + 1)] })
      else update({ files: newFiles, mutedFlags: [...mutedFlags.slice(0, i + 1), mutedFlags[i] || false, ...mutedFlags.slice(i + 1)], soloFlags: [...soloFlags.slice(0, i + 1), soloFlags[i] || false, ...soloFlags.slice(i + 1)] })
    }
    if (action === 'setLoop') {
      const cur = loopCounts[idx] || 1
      const v = prompt(t.loopPrompt(stem(files[idx])), String(cur))
      if (v !== null) {
        const n = Math.max(1, parseInt(v) || 1)
        const newLoops = [...loopCounts]
        newLoops[idx] = n
        update({ loopCounts: newLoops })
      }
    }
  }

  async function toggleOverlay() {
    if (state.overlayEnabled) {
      update({ overlayEnabled: false, overlayFile: '' })
    } else {
      const path = await window.api.dialog.openFile({
        title: 'Choose overlay file',
        filters: isAudio
          ? [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac'] }]
          : [{ name: 'Overlay', extensions: ['mov', 'png'] }]
      })
      if (!path) return
      update({ overlayEnabled: true, overlayFile: path })
    }
  }

  async function toggleIntro() {
    if (!isAudio && state.introEnabled) {
      update({ introEnabled: false, introFile: '' })
    } else if (!isAudio) {
      const path = await window.api.dialog.openFile({
        title: 'Choose Intro file',
        filters: [{ name: 'Intro', extensions: ['mp4', 'mov', 'png'] }]
      })
      if (!path) return
      update({ introEnabled: true, introFile: path })
    }
  }

  async function toggleSfxLoop() {
    const sfx = state.sfxLoop || {}
    if (sfx.enabled) {
      // Đang bật → tắt (giữ lại file để lần sau dùng lại)
      update({ sfxLoop: { ...sfx, enabled: false } })
    } else {
      // Đang tắt → chọn file rồi bật
      const path = await window.api.dialog.openFile({
        title: 'Chọn file SFX',
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'] }]
      })
      if (!path) return
      update({ sfxLoop: { enabled: true, file: path, count: sfx.count || 10 } })
    }
  }

  function setSfxCount(n) {
    const sfx = state.sfxLoop || {}
    update({ sfxLoop: { ...sfx, count: Math.max(1, n) } })
  }

  function setSfxBoundary(key, val) {
    const sfx = state.sfxLoop || {}
    update({ sfxLoop: { ...sfx, [key]: val } })
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--card)', borderRadius: 14,
      border: '1px solid var(--border)', overflow: 'hidden', height: '100%'
    }}
      onDragOver={e => e.preventDefault()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div style={{ padding: '14px 18px 0', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 8, flexShrink: 0,
          background: accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: accent
        }}>
          {isAudio ? '♫' : '▦'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
            {isAudio ? t.audio : t.video}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
            {t.files(files.length)} · {secToHMS(totalDuration)}
          </div>
        </div>
        {/* Video-only: Intro + Overlay chips */}
        {!isAudio && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ChipToggle label={state.introEnabled ? t.introOn : t.intro} active={state.introEnabled} color={accent} onClick={toggleIntro} />
            <ChipToggle label={state.overlayEnabled ? t.overlaid : t.overlay} active={state.overlayEnabled} color={accent} onClick={toggleOverlay} />
          </div>
        )}
        <Btn
          onClick={addFiles}
          style={{ background: accent, color: '#fff', border: 'none', borderRadius: 20, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}
        >
          {isAudio ? t.addMp3 : t.addMp4}
        </Btn>
      </div>

      {/* Options row */}
      <div style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Toggle label={t.autoShuffle} checked={state.shuffle} color={accent} onChange={v => update({ shuffle: v })} />
        <Btn onClick={randomizeNow} style={btnStyle}>{t.randomize}</Btn>
        {isAudio && <Toggle label={t.exportList} checked={state.exportList} color={accent} onChange={v => update({ exportList: v })} />}
        {isAudio && <ChipToggle label={state.overlayEnabled ? t.overlaid : t.overlay} active={state.overlayEnabled} color={accent} onClick={toggleOverlay} />}
        {isAudio && (
          <SfxLoopControl
            sfxLoop={state.sfxLoop}
            accent={accent}
            onToggle={toggleSfxLoop}
            onCountChange={setSfxCount}
            onBoundaryChange={setSfxBoundary}
          />
        )}
        {!isAudio && <Toggle label={t.scale} checked={state.scale !== false} color={accent} onChange={v => update({ scale: v })} />}
        <div style={{ flex: 1 }} />
        <button onClick={() => { if (confirm(t.confirmClear)) { update({ files: [], loopCounts: [], mutedFlags: [], soloFlags: [] }); setSelected([]) } }}
          style={{ background: 'none', border: 'none', color: '#D07E7E', fontSize: 12, cursor: 'pointer' }}>
          🗑 Clear
        </button>
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '0 12px 12px', position: 'relative' }}>
        <div style={{
          height: '100%', overflowY: 'auto', background: 'var(--soft)', borderRadius: 10,
          border: '1px solid var(--border)', position: 'relative'
        }}
          ref={listRef}
          onClick={(e) => { if (e.target === listRef.current || e.currentTarget === e.target) setSelected([]) }}
        >
          {draggingOver && (
            <div style={{
              position: 'absolute', inset: 0, background: accentSoft, zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2px dashed ${accent}`, borderRadius: 10, fontSize: 15, fontWeight: 600, color: accent
            }}>
              {t.dropHint(isAudio ? 'MP3' : 'MP4')}
            </div>
          )}
          {files.length === 0 && !draggingOver && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13, whiteSpace: 'pre-line' }}>
              {isAudio ? t.dropAudio : t.dropVideo}
            </div>
          )}
          {files.map((f, i) => (
            <FileRow
              key={f + i}
              index={i}
              file={f}
              isAudio={isAudio}
              duration={durations[f] || 0}
              muted={mutedFlags[i]}
              solo={soloFlags[i]}
              loopCount={loopCounts[i] || 1}
              selected={selected.includes(i)}
              accent={accent}
              dragOver={dragOverIdx === i}
              onSelect={(e) => {
                if (e.shiftKey && selected.length) {
                  const last = selected[selected.length - 1]
                  const range = []
                  for (let j = Math.min(i, last); j <= Math.max(i, last); j++) range.push(j)
                  setSelected(range)
                } else if (e.ctrlKey || e.metaKey) {
                  setSelected(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i])
                } else {
                  setSelected([i])
                }
              }}
              onCtxMenu={(e) => {
                e.preventDefault()
                setSelected(s => s.includes(i) ? s : [i])
                setCtxMenu({ x: e.clientX, y: e.clientY, idx: i })
              }}
              onRowDragStart={() => { isDraggingRow.current = true; dragSrcRef.current = i }}
              onRowDragEnter={() => { if (isDraggingRow.current) setDragOverIdx(i) }}
              onRowDragEnd={() => {
                reorderTo(dragSrcRef.current, dragOverIdx)
                isDraggingRow.current = false
                dragSrcRef.current = null
                setDragOverIdx(null)
              }}
            />
          ))}
        </div>

        {ctxMenu && (
          <ContextMenu
            x={ctxMenu.x} y={ctxMenu.y} idx={ctxMenu.idx}
            isAudio={isAudio}
            muted={mutedFlags[ctxMenu.idx]}
            solo={soloFlags[ctxMenu.idx]}
            onAction={handleCtxAction}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </div>
    </div>
  )
}

function FileRow({ index, file, isAudio, duration, muted, solo, loopCount, selected, accent, dragOver, onSelect, onCtxMenu, onRowDragStart, onRowDragEnter, onRowDragEnd }) {
  const name = stem(file)
  const dur = duration > 0 ? secToHMS(duration) : '--:--:--'
  return (
    <div
      draggable
      onClick={onSelect}
      onContextMenu={onCtxMenu}
      onDragStart={(e) => { e.stopPropagation(); onRowDragStart() }}
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); onRowDragEnter() }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
      onDragEnd={(e) => { e.stopPropagation(); onRowDragEnd() }}
      style={{
        display: 'flex', alignItems: 'center', padding: '6px 10px', gap: 8,
        background: selected ? (accent === '#5A3DF0' ? '#EDE8FF' : '#E0FAF7') : 'transparent',
        cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 12,
        transition: 'background 0.1s',
        borderTop: dragOver ? `2px solid ${accent}` : '2px solid transparent',
      }}
    >
      <span style={{ color: 'var(--border)', fontSize: 13, cursor: 'grab', flexShrink: 0, lineHeight: 1 }}>⠿</span>
      <span style={{ color: 'var(--muted)', minWidth: 20, textAlign: 'right', fontSize: 11 }}>{index + 1}</span>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
          {name}
          {!isAudio && muted && <span style={{ marginLeft: 6, fontSize: 10, color: '#EC8B8B', fontWeight: 600 }}>MUTED</span>}
          {!isAudio && solo && <span style={{ marginLeft: 6, fontSize: 10, color: accent, fontWeight: 600 }}>SOLO</span>}
          {isAudio && loopCount > 1 && <span style={{ marginLeft: 6, fontSize: 10, color: accent, fontWeight: 600 }}>×{loopCount}</span>}
        </div>
      </div>
      <span style={{ color: 'var(--muted)', fontSize: 11, flexShrink: 0 }}>{dur}</span>
    </div>
  )
}

function ContextMenu({ x, y, idx, isAudio, muted, solo, onAction, onClose }) {
  const { t } = useLang()
  const items = [
    { label: t.ctxPlay, action: 'play' },
    !isAudio && { label: muted ? t.ctxUnmute : t.ctxMute, action: 'mute' },
    !isAudio && { label: solo ? t.ctxSoloOff : t.ctxSolo, action: 'solo' },
    isAudio && { label: t.ctxSetLoop, action: 'setLoop' },
    { label: t.ctxDuplicate, action: 'duplicate' },
    { label: t.ctxDelete, action: 'delete' },
    'sep',
    { label: t.ctxMoveUp, action: 'up' },
    { label: t.ctxMoveDown, action: 'down' },
    'sep',
    { label: t.ctxBringTop, action: 'top' },
    { label: t.ctxBringBottom, action: 'bottom' },
    'sep',
    { label: t.ctxOpenFolder, action: 'folder' }
  ].filter(Boolean)

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={onClose} />
      <div style={{
        position: 'fixed', left: x, top: y, zIndex: 1000,
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        minWidth: 160, padding: '4px 0', fontSize: 13
      }}>
        {items.map((item, i) =>
          item === 'sep' ? (
            <div key={i} style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
          ) : (
            <div key={i}
              onClick={() => onAction(item.action, idx)}
              style={{ padding: '6px 14px', cursor: 'pointer', color: item.action === 'delete' ? '#EC8B8B' : 'var(--text)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--soft)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {item.label}
            </div>
          )
        )}
      </div>
    </>
  )
}

function BoundaryInput({ label, value, placeholder, accent, isEnd, onChange }) {
  const [localText, setLocalText] = useState(null)
  const inputRef = useRef(null)

  // Khi không focus: hiện MM:SS hoặc rỗng (value=0 → placeholder)
  // Khi focus: luôn hiện MM:SS để arrow keys có chỗ làm việc
  const displayed = localText !== null ? localText : (value > 0 ? secToMMSS(value) : '')

  function commit(secs) { onChange(Math.max(0, secs)) }

  function handleKeyDown(e) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()

    const direction = e.key === 'ArrowUp' ? 1 : -1
    const step = e.shiftKey ? 10 : 1
    const text = localText !== null ? localText : secToMMSS(value)
    const colonIdx = text.indexOf(':')

    // Parse MM và SS từ text hiện tại
    let mins = 0, secs = 0
    if (colonIdx >= 0) {
      mins = parseInt(text.slice(0, colonIdx)) || 0
      secs = parseInt(text.slice(colonIdx + 1)) || 0
    } else {
      const total = parseTimecode(text) || value
      mins = Math.floor(total / 60)
      secs = total % 60
    }

    // Cursor ở đâu → thay đổi phần đó
    const cursorPos = inputRef.current?.selectionStart ?? (colonIdx + 1)
    const inMinutes = colonIdx >= 0 && cursorPos <= colonIdx

    if (inMinutes) {
      mins = Math.max(0, mins + direction * step)
    } else {
      secs += direction * step
      if (secs >= 60) { mins += Math.floor(secs / 60); secs %= 60 }
      if (secs < 0) { if (mins > 0) { mins--; secs += 60 } else secs = 0 }
    }

    const total = mins * 60 + secs
    const formatted = secToMMSS(total)
    commit(total)
    setLocalText(formatted)

    // Giữ cursor đúng vùng sau khi React re-render
    requestAnimationFrame(() => {
      if (!inputRef.current) return
      const ci = formatted.indexOf(':')
      const pos = inMinutes ? ci : formatted.length
      inputRef.current.setSelectionRange(pos, pos)
    })
  }

  return (
    <div
      title={isEnd
        ? 'SFX kết thúc tại đây · để trống = hết track\n↑↓ thay đổi phần con trỏ đang ở · Shift×10'
        : 'SFX bắt đầu tại đây · để trống = 0:00\n↑↓ thay đổi phần con trỏ đang ở · Shift×10'}
      style={{
        display: 'flex', alignItems: 'center', gap: 3,
        border: `1px solid ${accent}`, borderRadius: 10,
        padding: '3px 6px', background: 'var(--soft)'
      }}
    >
      <span style={{ fontSize: 10, color: accent, fontWeight: 700 }}>{label}</span>
      <input
        ref={inputRef}
        type="text"
        value={displayed}
        placeholder={placeholder}
        onFocus={() => {
          const fmt = secToMMSS(value)
          setLocalText(fmt)
          // Đặt cursor vào vùng MM sau khi React re-render → ArrowUp đổi phút ngay
          requestAnimationFrame(() => {
            if (!inputRef.current) return
            inputRef.current.setSelectionRange(0, 0)
          })
        }}
        onChange={e => setLocalText(e.target.value)}
        onBlur={() => {
          commit(parseTimecode(localText || ''))
          setLocalText(null)
        }}
        onKeyDown={handleKeyDown}
        style={{
          width: 44, border: 'none', background: 'transparent',
          fontSize: 12, fontWeight: 600, color: 'var(--muted)',
          textAlign: 'center', outline: 'none', padding: 0
        }}
      />
    </div>
  )
}

function SfxLoopControl({ sfxLoop, accent, onToggle, onCountChange, onBoundaryChange }) {
  const { t } = useLang()
  const enabled = sfxLoop?.enabled
  const count = sfxLoop?.count || 10
  const sfxStart = sfxLoop?.sfxStart || 0
  const sfxEnd = sfxLoop?.sfxEnd || 0

  const box = {
    display: 'flex', alignItems: 'center', gap: 3,
    border: `1px solid ${accent}`, borderRadius: 10,
    padding: '3px 6px', background: 'var(--soft)'
  }
  const inp = {
    border: 'none', background: 'transparent',
    fontSize: 12, fontWeight: 600, color: 'var(--muted)',
    textAlign: 'center', outline: 'none', padding: 0
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        onClick={onToggle}
        title={enabled ? `SFX: ${sfxLoop.file}\nClick để tắt` : 'Chọn file SFX'}
        style={{
          border: `1px solid ${enabled ? accent : 'var(--btn-border)'}`,
          background: enabled ? accent : 'transparent',
          color: enabled ? '#fff' : 'var(--muted)',
          borderRadius: 14, padding: '4px 10px',
          fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
        }}
      >
        {t.sfxLoop}
      </button>

      {enabled && (
        <>
          {/* × N */}
          <div style={box}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>×</span>
            <input type="number" min={1} max={9999} value={count}
              onChange={e => onCountChange(parseInt(e.target.value) || 1)}
              onBlur={e => onCountChange(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ ...inp, width: 40 }} />
          </div>
          <BoundaryInput
            label="A" value={sfxStart} placeholder="0:00"
            accent={accent} isEnd={false}
            onChange={v => onBoundaryChange('sfxStart', v)}
          />
          <BoundaryInput
            label="B" value={sfxEnd} placeholder="end"
            accent={accent} isEnd={true}
            onChange={v => onBoundaryChange('sfxEnd', v)}
          />
        </>
      )}
    </div>
  )
}

function ChipToggle({ label, active, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      border: `1px solid ${active ? color : 'var(--btn-border)'}`,
      background: active ? color : 'transparent',
      color: active ? '#fff' : 'var(--muted)',
      borderRadius: 14, padding: '4px 10px', fontSize: 11, fontWeight: 600,
      cursor: 'pointer', transition: 'all 0.15s'
    }}>
      {label}
    </button>
  )
}

const btnStyle = {
  background: 'var(--soft)', border: '1px solid var(--btn-border)',
  color: 'var(--text)', borderRadius: 14, padding: '5px 12px', fontSize: 12,
  cursor: 'pointer'
}
