import { useState, useRef, useEffect } from 'react'
import Btn from './Btn'

const LANGUAGES = [
  { name: 'Vietnamese',            code: 'vi' },
  { name: 'English',               code: 'en' },
  { name: 'Spanish',               code: 'es' },
  { name: 'French',                code: 'fr' },
  { name: 'German',                code: 'de' },
  { name: 'Italian',               code: 'it' },
  { name: 'Portuguese',            code: 'pt' },
  { name: 'Russian',               code: 'ru' },
  { name: 'Japanese',              code: 'ja' },
  { name: 'Korean',                code: 'ko' },
  { name: 'Chinese (Simplified)',  code: 'zh-CN' },
  { name: 'Chinese (Traditional)', code: 'zh-TW' },
  { name: 'Arabic',                code: 'ar' },
  { name: 'Hindi',                 code: 'hi' },
  { name: 'Thai',                  code: 'th' },
  { name: 'Indonesian',            code: 'id' },
  { name: 'Malay',                 code: 'ms' },
  { name: 'Turkish',               code: 'tr' },
  { name: 'Dutch',                 code: 'nl' },
  { name: 'Polish',                code: 'pl' },
]

const CATEGORIES = [
  'Film & Animation', 'Autos & Vehicles', 'Music', 'Pets & Animals',
  'Sports', 'Travel & Events', 'Gaming', 'People & Blogs',
  'Comedy', 'Entertainment', 'News & Politics', 'Howto & Style',
  'Education', 'Science & Technology', 'Nonprofits & Activism',
]

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function makePreset() {
  return { id: makeId(), name: 'New Preset', title: '', description: '', hashtags: '', tags: '', category: '', language: '', rating: 0 }
}

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(value === n ? 0 : n)}
          style={{ fontSize: 22, cursor: 'pointer', lineHeight: 1, userSelect: 'none',
            color: n <= (hover || value) ? '#F59E0B' : 'var(--border)' }}
        >★</span>
      ))}
    </div>
  )
}

function Radio({ checked, onClick }) {
  return (
    <div onClick={onClick} style={{
      width: 14, height: 14, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
      border: `2px solid ${checked ? '#5A3DF0' : 'var(--muted)'}`,
      background: checked ? '#5A3DF0' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      {checked && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
    </div>
  )
}

const inputStyle = {
  flex: 1, padding: '4px 8px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--soft)',
  color: 'var(--text)', fontSize: 13
}
const labelStyle = {
  width: 74, fontSize: 12, color: 'var(--muted)',
  textAlign: 'right', flexShrink: 0, paddingTop: 3
}

// Single-line fields
const LINE_FIELDS = [
  { key: 'name',     label: 'Name',     placeholder: 'Tên preset' },
  { key: 'title',    label: 'Title',    placeholder: 'Tiêu đề video' },
  { key: 'hashtags', label: 'Hashtags', placeholder: '#hash1 #hash2 #hash3' },
  { key: 'tags',     label: 'Tags',     placeholder: 'keyword1, keyword2, keyword3' },
  { key: 'category', label: 'Category', placeholder: 'Music, Gaming, Education...' },
  { key: 'language', label: 'Language', placeholder: 'vi, en, ko...' },
]

function LanguageField({ value, onChange, inputStyle, labelStyle }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const wrapRef = useRef(null)

  // Sync query when value changes from outside (e.g. startEdit)
  useEffect(() => { setQuery(value || '') }, [value])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const q = query.trim().toLowerCase()
  const suggestions = q.length === 0
    ? LANGUAGES
    : LANGUAGES.filter(l =>
        l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)
      )

  function pick(lang) {
    setQuery(lang.code)
    onChange(lang.code)
    setOpen(false)
  }

  function handleChange(e) {
    setQuery(e.target.value)
    onChange(e.target.value)
    setOpen(true)
  }

  return (
    <div ref={wrapRef} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8, position: 'relative' }}>
      <span style={labelStyle}>Language</span>
      <div style={{ flex: 1, position: 'relative' }}>
        <input
          value={query}
          placeholder="vi, en, es, ko..."
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'Enter' && suggestions.length > 0) { pick(suggestions[0]); e.preventDefault() }
          }}
          style={inputStyle}
        />
        {open && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
            maxHeight: 200, overflowY: 'auto', marginTop: 3
          }}>
            {suggestions.map(l => (
              <div
                key={l.code}
                onMouseDown={() => pick(l)}
                style={{
                  padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: '1px solid var(--border)'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--soft)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ color: 'var(--text)' }}>{l.name}</span>
                <span style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'monospace', marginLeft: 12, flexShrink: 0 }}>{l.code}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryField({ value, onChange, inputStyle, labelStyle }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handler(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const q = (value || '').trim().toLowerCase()
  const suggestions = q.length === 0 ? CATEGORIES : CATEGORIES.filter(c => c.toLowerCase().includes(q))

  return (
    <div ref={wrapRef} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8, position: 'relative' }}>
      <span style={labelStyle}>Category</span>
      <div style={{ flex: 1, position: 'relative' }}>
        <input
          value={value || ''}
          placeholder="Music, Gaming, Education..."
          onChange={e => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'Enter' && suggestions.length > 0) { onChange(suggestions[0]); setOpen(false); e.preventDefault() }
          }}
          style={inputStyle}
        />
        {open && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
            maxHeight: 200, overflowY: 'auto', marginTop: 3
          }}>
            {suggestions.map(c => (
              <div key={c} onMouseDown={() => { onChange(c); setOpen(false) }}
                style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--soft)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >{c}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function HashtagsField({ value, onChange, presets, inputStyle, labelStyle }) {
  const [open, setOpen] = useState(false)
  const [curToken, setCurToken] = useState('')
  const inputRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handler(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Collect unique hashtags from all existing presets
  const allHashtags = (() => {
    const set = new Set()
    ;(presets || []).forEach(p => {
      if (p.hashtags) p.hashtags.trim().split(/\s+/).forEach(h => { if (h.startsWith('#') && h.length > 1) set.add(h) })
    })
    return [...set]
  })()

  function getToken(val, pos) {
    const parts = val.substring(0, pos).split(/\s+/)
    return parts[parts.length - 1] || ''
  }

  const q = curToken.toLowerCase().replace(/^#/, '')
  const suggestions = q.length === 0 ? [] : allHashtags.filter(h =>
    h.toLowerCase().replace(/^#/, '').includes(q) && h.toLowerCase() !== curToken.toLowerCase()
  )

  function pick(tag) {
    const input = inputRef.current
    if (!input) return
    const pos = input.selectionStart
    const before = value.substring(0, pos)
    const after = value.substring(pos)
    const parts = before.split(/\s+/)
    parts[parts.length - 1] = tag
    const newVal = parts.join(' ') + (after.trimStart() ? ' ' + after.trimStart() : ' ')
    onChange(newVal)
    setOpen(false); setCurToken('')
    setTimeout(() => { input.focus(); const p = parts.join(' ').length + 1; input.setSelectionRange(p, p) }, 0)
  }

  function handleChange(e) {
    onChange(e.target.value)
    const token = getToken(e.target.value, e.target.selectionStart)
    setCurToken(token)
    setOpen(token.length > 0)
  }

  return (
    <div ref={wrapRef} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8, position: 'relative' }}>
      <span style={labelStyle}>Hashtags</span>
      <div style={{ flex: 1, position: 'relative' }}>
        <input
          ref={inputRef}
          value={value || ''}
          placeholder="#hash1 #hash2 #hash3"
          onChange={handleChange}
          onKeyDown={e => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'Enter' && open && suggestions.length > 0) { pick(suggestions[0]); e.preventDefault() }
          }}
          style={inputStyle}
        />
        {open && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
            maxHeight: 160, overflowY: 'auto', marginTop: 3
          }}>
            {suggestions.map(h => (
              <div key={h} onMouseDown={() => pick(h)}
                style={{ padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: '#5A3DF0', fontWeight: 600, borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--soft)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >{h}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MetadataPresetDialog({ jobName, presets: initPresets, selectedId: initSelectedId, onSave, onClose }) {
  const [presets, setPresets]       = useState(initPresets || [])
  const [selectedId, setSelectedId] = useState(initSelectedId || null)
  const [editing, setEditing]       = useState(null)
  const [isNewEdit, setIsNewEdit]   = useState(false)

  function startNew() {
    const p = makePreset()
    setPresets(ps => [...ps, p])
    setEditing({ ...p })
    setIsNewEdit(true)
  }

  function startEdit(p) {
    // Migrate old preset format (subtitle→description, comments→description)
    const migrated = {
      ...makePreset(),
      ...p,
      description: p.description || p.comments || '',
      hashtags: p.hashtags || '',
      category: p.category || '',
      language: p.language || '',
    }
    setEditing(migrated)
    setIsNewEdit(false)
  }

  function cancelEdit() {
    if (isNewEdit && editing) setPresets(ps => ps.filter(p => p.id !== editing.id))
    setEditing(null)
    setIsNewEdit(false)
  }

  function saveEdit() {
    if (!editing || !editing.name.trim()) return
    setPresets(ps => ps.map(p => p.id === editing.id ? { ...editing } : p))
    setEditing(null)
    setIsNewEdit(false)
  }

  function deletePreset(id) {
    setPresets(ps => ps.filter(p => p.id !== id))
    if (selectedId === id) setSelectedId(null)
    if (editing?.id === id) { setEditing(null); setIsNewEdit(false) }
  }

  function field(key) {
    return (
      <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <span style={labelStyle}>{LINE_FIELDS.find(f => f.key === key)?.label}</span>
        <input
          value={editing[key] || ''}
          placeholder={LINE_FIELDS.find(f => f.key === key)?.placeholder || ''}
          onChange={e => setEditing(f => ({ ...f, [key]: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && key !== 'description' && saveEdit()}
          style={inputStyle}
        />
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <div style={{
        background: 'var(--card)', borderRadius: 14, padding: 24, minWidth: 500, maxWidth: 580,
        maxHeight: '90vh', overflowY: 'auto',
        border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 3 }}>📋 SEO Metadata — {jobName}</div>
        <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 16 }}>
          Chọn preset để ghi metadata vào MP4 output.
        </div>

        {/* Preset list */}
        <div style={{ marginBottom: 10 }}>
          <div
            onClick={() => setSelectedId(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 2, background: !selectedId ? 'var(--soft)' : 'transparent' }}
          >
            <Radio checked={!selectedId} />
            <span style={{ fontSize: 13, color: 'var(--muted)', flex: 1 }}>None</span>
          </div>

          {presets.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 8, marginBottom: 2, background: selectedId === p.id ? 'var(--soft)' : 'transparent' }}>
              <Radio checked={selectedId === p.id} onClick={() => setSelectedId(p.id)} />
              <div onClick={() => setSelectedId(p.id)} style={{ flex: 1, cursor: 'pointer' }}>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{p.name}</div>
                {(p.category || p.language) && (
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                    {[p.category, p.language].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 12, letterSpacing: -1, color: '#F59E0B', flexShrink: 0 }}>
                {'★'.repeat(p.rating || 0)}{'☆'.repeat(5 - (p.rating || 0))}
              </span>
              <button onClick={() => startEdit(p)} title="Edit"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, padding: '0 3px' }}>✎</button>
              <button onClick={() => deletePreset(p.id)} title="Delete"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EC8B8B', fontSize: 13, padding: '0 3px' }}>✕</button>
            </div>
          ))}
        </div>

        <Btn onClick={startNew} style={{ fontSize: 12 }}>+ New Preset</Btn>

        {/* Edit form */}
        {editing && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {isNewEdit ? 'New Preset' : `Edit: ${presets.find(p => p.id === editing.id)?.name || ''}`}
            </div>

            {/* Name & Title */}
            {field('name')}
            {field('title')}

            {/* Description — textarea */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <span style={{ ...labelStyle, paddingTop: 6 }}>Description</span>
              <textarea
                value={editing.description || ''}
                placeholder={'Mô tả video đầy đủ\nKeywords, timestamps, links...'}
                onChange={e => setEditing(f => ({ ...f, description: e.target.value }))}
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }}
              />
            </div>

            {/* Hashtags */}
            <HashtagsField
              value={editing.hashtags || ''}
              onChange={v => setEditing(f => ({ ...f, hashtags: v }))}
              presets={presets}
              inputStyle={inputStyle}
              labelStyle={labelStyle}
            />

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--border)', margin: '10px 0' }} />

            {/* Tags / Category / Language */}
            {field('tags')}
            <CategoryField
              value={editing.category || ''}
              onChange={v => setEditing(f => ({ ...f, category: v }))}
              inputStyle={inputStyle}
              labelStyle={labelStyle}
            />
            <LanguageField
              value={editing.language || ''}
              onChange={v => setEditing(f => ({ ...f, language: v }))}
              inputStyle={inputStyle}
              labelStyle={labelStyle}
            />

            {/* Rating */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ ...labelStyle, paddingTop: 0 }}>Rating</span>
              <StarRating value={editing.rating || 0} onChange={v => setEditing(f => ({ ...f, rating: v }))} />
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>(file)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <Btn onClick={cancelEdit}>Cancel</Btn>
              <Btn onClick={saveEdit} style={{ background: '#5A3DF0', color: '#fff', border: 'none', fontWeight: 600 }}>Save Preset</Btn>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn onClick={() => onSave(selectedId, presets)}
            style={{ background: '#18C9B7', color: '#fff', border: 'none', fontWeight: 600 }}>Apply</Btn>
        </div>
      </div>
    </div>
  )
}
