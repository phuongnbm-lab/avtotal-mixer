import { useState, useEffect, useRef } from 'react'
import Toggle from './Toggle'
import Btn from './Btn'
import { shortenMiddle, secToHMS } from '../utils'
import { useLang } from '../LangContext'

const RESOLUTIONS = ['FullHD', '4K']

export default function OutputCard({
  outputName, setOutputName,
  outputFolder, setOutputFolder,
  resolution, setResolution,
  musicFolder, setMusicFolder,
  clipFolder, setClipFolder,
  audioState, videoState,
  queue, setQueue,
  onAddToQueue, onQuickRender, onResetAll,
  renderActive
}) {
  const { t } = useLang()
  const [bookmarks, setBookmarks] = useState([])
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)

  useEffect(() => {
    window.api.bookmarks.load().then(b => {
      setBookmarks(b || [])
      checkBookmarked(b || [], outputFolder)
    })
  }, [])

  useEffect(() => {
    checkBookmarked(bookmarks, outputFolder)
  }, [outputFolder, bookmarks])

  function checkBookmarked(bms, folder) {
    if (!folder) { setIsBookmarked(false); return }
    setIsBookmarked(bms.some(b => b.toLowerCase() === folder.toLowerCase()))
  }

  async function toggleBookmark() {
    if (!outputFolder) return
    let newBms
    if (isBookmarked) {
      newBms = bookmarks.filter(b => b.toLowerCase() !== outputFolder.toLowerCase())
    } else {
      newBms = [outputFolder, ...bookmarks.filter(b => b.toLowerCase() !== outputFolder.toLowerCase())].slice(0, 20)
    }
    setBookmarks(newBms)
    await window.api.bookmarks.save(newBms)
    checkBookmarked(newBms, outputFolder)
  }

  async function pickFolder() {
    const folder = await window.api.dialog.openFolder({ title: 'Choose output folder' })
    if (folder) setOutputFolder(folder)
  }

  function openFolder() {
    if (outputFolder) window.api.shell.openPath(outputFolder)
  }

  // Job count based on current state
  const hasAudio = (audioState?.files?.length || 0) + (musicFolder?.enabled ? 1 : 0) > 0
  const hasVideo = (videoState?.files?.length || 0) + (clipFolder?.enabled ? 1 : 0) > 0
  const canAdd = hasAudio && hasVideo && outputName.trim() && outputFolder.trim()

  return (
    <div style={{
      background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)',
      padding: '14px 18px', marginBottom: 12
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)', letterSpacing: 1 }}>{t.outputSection}</span>
        <Btn
          onClick={onResetAll}
          disabled={renderActive}
          title="Reset all input files and output name"
          style={{
            marginLeft: 10,
            background: renderActive ? undefined : '#C0392B',
            color: renderActive ? '#EC8B8B' : '#fff',
            border: 'none',
            fontWeight: 700,
            fontSize: 12,
            padding: '5px 13px',
            letterSpacing: 0.3
          }}
        >
          {t.resetAll}
        </Btn>
        <div style={{ flex: 1 }} />
        {/* Folder source controls */}
        <FolderSource
          title={t.musicFolder} color="#5A3DF0"
          state={musicFolder} onChange={setMusicFolder}
          exts={['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg']}
          excludeFiles={audioState?.files || []}
        />
        <div style={{ width: 18 }} />
        <FolderSource
          title={t.clipFolder} color="#18C9B7"
          state={clipFolder} onChange={setClipFolder}
          exts={['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v']}
          excludeFiles={videoState?.files || []}
        />
        <div style={{ width: 18 }} />
        <Btn
          onClick={onQuickRender}
          disabled={!canAdd || renderActive}
          title="Render immediately, skip queue"
          style={{
            background: canAdd && !renderActive ? '#5A3DF0' : undefined,
            color: canAdd && !renderActive ? '#fff' : undefined,
            border: canAdd && !renderActive ? 'none' : undefined,
            fontWeight: 700, fontSize: 13, padding: '9px 18px', borderRadius: 18,
            marginRight: 8
          }}
        >
          {t.quickRender}
        </Btn>
        <Btn
          onClick={onAddToQueue}
          disabled={!canAdd || renderActive}
          style={{
            background: canAdd && !renderActive ? '#18C9B7' : undefined,
            color: canAdd && !renderActive ? '#fff' : undefined,
            border: canAdd && !renderActive ? 'none' : undefined,
            fontWeight: 700, fontSize: 13, padding: '9px 20px', borderRadius: 18
          }}
        >
          {t.addToQueue}
        </Btn>
      </div>

      {/* Row 1: File name + Resolution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>{t.fileName}</label>
          <input
            value={outputName}
            onChange={e => setOutputName(e.target.value)}
            style={inputStyle}
            placeholder="VideoMix"
          />
        </div>
        <div>
          <label style={labelStyle}>{t.resolution}</label>
          <select value={resolution} onChange={e => setResolution(e.target.value)} style={{ ...inputStyle, width: 140 }}>
            {RESOLUTIONS.map(r => <option key={r} value={r}>{r === 'FullHD' ? 'Full HD (1080p)' : '4K (2160p)'}</option>)}
          </select>
        </div>
      </div>

      {/* Row 2: Output folder */}
      <div>
        <label style={labelStyle}>{t.outputFolder}</label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ ...inputStyle, flex: 1, display: 'flex', alignItems: 'center', color: outputFolder ? 'var(--text)' : 'var(--muted)', fontSize: 12 }}>
            {outputFolder ? shortenMiddle(outputFolder, 72) : t.noFolder}
          </div>
          <Btn onClick={pickFolder}>{t.browse}</Btn>
          <Btn onClick={openFolder} disabled={!outputFolder} title="Open folder">📂</Btn>
          <Btn
            onClick={toggleBookmark}
            disabled={!outputFolder}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark this folder'}
            style={isBookmarked ? { background: '#5A3DF0', color: '#fff', border: 'none' } : {}}
          >
            {isBookmarked ? '★' : '☆'}
          </Btn>
          {bookmarks.length > 0 && (
            <div style={{ position: 'relative' }}>
              <Btn onClick={() => setShowBookmarks(s => !s)}>{t.saved}</Btn>
              {showBookmarks && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowBookmarks(false)} />
                  <div style={{
                    position: 'absolute', right: 0, top: '110%', zIndex: 100,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 8, minWidth: 280, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                    padding: '4px 0'
                  }}>
                    {bookmarks.map((bm, i) => (
                      <div key={i} onClick={() => { setOutputFolder(bm); setShowBookmarks(false) }}
                        style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--soft)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {shortenMiddle(bm, 48)}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FolderSource({ title, color, state, onChange, exts, excludeFiles = [] }) {
  const { t } = useLang()
  const [estDuration, setEstDuration] = useState(null)
  const [fileCount, setFileCount] = useState(null)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!state.enabled || !state.folder) { setEstDuration(null); setFileCount(null); return }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const all = await window.api.fs.listMedia({
          folder: state.folder, extensions: exts, includeSubfolders: state.subfolders
        })
        const excludeSet = new Set(excludeFiles)
        const available = all.filter(f => !excludeSet.has(f))
        setFileCount(all.length)
        const num = state.num || 0
        let files
        if (num <= 0) {
          files = available
        } else if (num <= available.length) {
          files = available.slice(0, num)
        } else {
          const extras = Array.from({ length: num - available.length }, () => available[Math.floor(Math.random() * available.length)])
          files = [...available, ...extras]
        }
        let total = 0
        for (const f of files) {
          const d = await window.api.ffmpeg.duration(f).catch(() => 0)
          total += d
        }
        setEstDuration(total)
      } catch { setEstDuration(null); setFileCount(null) }
      setLoading(false)
    }, 500)
    return () => clearTimeout(timerRef.current)
  }, [state.folder, state.num, state.subfolders, state.enabled, excludeFiles.length])

  async function toggleEnabled() {
    if (!state.enabled) {
      const folder = await window.api.dialog.openFolder({ title: `Select ${title}` })
      if (!folder) return
      onChange({ ...state, enabled: true, folder })
    } else {
      onChange({ ...state, enabled: false })
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Toggle label={title} checked={state.enabled} color={color} onChange={v => {
        if (v) toggleEnabled()
        else onChange({ ...state, enabled: false })
      }} />
      {state.enabled && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t.num}</span>
            <input
              type="number" min={0} max={9999}
              value={state.num || 0}
              onChange={e => onChange({ ...state, num: parseInt(e.target.value) || 0 })}
              onKeyDown={e => {
                if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
                e.preventDefault()
                const step = e.ctrlKey && e.shiftKey ? 20 : e.shiftKey ? 10 : 1
                const delta = e.key === 'ArrowUp' ? step : -step
                onChange({ ...state, num: Math.min(9999, Math.max(0, (state.num || 0) + delta)) })
              }}
              style={{ width: `${String(state.num || 0).length + 2}ch`, padding: '2px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--soft)', color: 'var(--text)', fontSize: 12, textAlign: 'center' }}
            />
          </div>
          {loading
            ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>...</span>
            : estDuration !== null && (
              <span style={{ fontSize: 11, color, fontWeight: 600 }}>
                {secToHMS(estDuration)}
              </span>
            )
          }
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
            <input type="checkbox" checked={state.subfolders} onChange={e => onChange({ ...state, subfolders: e.target.checked })} />
            {t.sub}
          </label>
          {fileCount !== null && (
            <span style={{ fontSize: 11, color: '#18C9B7', fontWeight: 700 }}>
              {t.total}: {fileCount.toLocaleString()}
            </span>
          )}
        </>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }
const inputStyle = {
  display: 'block', width: '100%', padding: '8px 12px',
  borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--soft)', color: 'var(--text)', fontSize: 13,
  outline: 'none', fontFamily: 'inherit'
}
