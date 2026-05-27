import { useState } from 'react'
import Btn from './Btn'
import { basename } from '../utils'

export default function CTADialog({ jobIndex, job, prevJob, onSave, onClose }) {
  const [slots, setSlots] = useState(job.ctaSlots || [])

  async function addSlot() {
    const file = await window.api.dialog.openFile({
      title: 'Choose CTA file',
      filters: [{ name: 'CTA files', extensions: ['mov', 'png', 'mp4'] }]
    })
    if (!file) return
    setSlots(s => [...s, { file, timecode: '00:00:00' }])
  }

  function updateTimecode(i, v) {
    setSlots(s => s.map((slot, idx) => idx === i ? { ...slot, timecode: v } : slot))
  }

  function adjustTimecode(tc, cursorPos, delta) {
    const parts = tc.split(':')
    if (parts.length !== 3) return tc
    let [h, m, s] = parts.map(Number)
    if ([h, m, s].some(isNaN)) return tc
    // segment: 0-2 = hours, 3-5 = minutes, 6-8 = seconds
    if (cursorPos <= 2) {
      h = Math.max(0, Math.min(99, h + delta))
    } else if (cursorPos <= 5) {
      m += delta
      if (m > 59) { m = 0;  h = Math.min(99, h + 1) }
      if (m < 0)  { m = 59; h = Math.max(0,  h - 1) }
    } else {
      s += delta
      if (s > 59) { s = 0;  m++; if (m > 59) { m = 0;  h = Math.min(99, h + 1) } }
      if (s < 0)  { s = 59; m--; if (m < 0)  { m = 59; h = Math.max(0,  h - 1) } }
    }
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  function removeSlot(i) {
    setSlots(s => s.filter((_, idx) => idx !== i))
  }

  async function replaceFile(i) {
    const file = await window.api.dialog.openFile({
      title: 'Replace CTA file',
      filters: [{ name: 'CTA files', extensions: ['mov', 'png', 'mp4'] }]
    })
    if (!file) return
    setSlots(s => s.map((slot, idx) => idx === i ? { ...slot, file } : slot))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <div style={{
        background: 'var(--card)', borderRadius: 14, padding: 24, minWidth: 480, maxWidth: 560,
        border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>CTA Slots — {job.name}</div>
        <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 16 }}>
          Add CTA overlay files with timecodes (hh:mm:ss). The overlay will appear at the specified time.
        </div>

        {slots.length === 0 && (
          <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            No CTA slots. Click "Add CTA" to add one.
          </div>
        )}

        {slots.map((slot, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div
              onClick={() => replaceFile(i)}
              title="Click to replace file"
              style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}
            >
              {basename(slot.file)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>@</span>
              <input
                value={slot.timecode}
                onChange={e => updateTimecode(i, e.target.value)}
                onKeyDown={e => {
                  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
                  e.preventDefault()
                  const pos = e.target.selectionStart ?? 8
                  const el  = e.target
                  const step  = e.shiftKey ? 10 : 1
                  const newTc = adjustTimecode(slot.timecode, pos, e.key === 'ArrowUp' ? step : -step)
                  updateTimecode(i, newTc)
                  requestAnimationFrame(() => el.setSelectionRange(pos, pos))
                }}
                style={{ width: 90, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--soft)', color: 'var(--text)', fontSize: 12, fontFamily: 'monospace' }}
                placeholder="00:00:00"
              />
            </div>
            <button onClick={() => setSlots(s => [...s.slice(0, i + 1), { ...s[i] }, ...s.slice(i + 1)])} title="Duplicate" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13 }}>⧉</button>
            <button onClick={() => removeSlot(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EC8B8B', fontSize: 14 }}>✕</button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Btn onClick={addSlot} style={{ background: '#5A3DF0', color: '#fff', border: 'none', fontWeight: 600 }}>+ Add CTA</Btn>
          {prevJob?.ctaSlots?.length > 0 && (
            <Btn
              onClick={() => setSlots(prevJob.ctaSlots.map(s => ({ ...s })))}
              title={`Inherit ${prevJob.ctaSlots.length} CTA(s) from "${prevJob.name}"`}
              style={{ background: '#F59E0B', color: '#fff', border: 'none', fontWeight: 600 }}
            >
              ⬇ Inherit from previous job
            </Btn>
          )}
          <div style={{ flex: 1 }} />
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn onClick={() => onSave(jobIndex, slots)} style={{ background: '#18C9B7', color: '#fff', border: 'none', fontWeight: 600 }}>Save</Btn>
        </div>
      </div>
    </div>
  )
}
