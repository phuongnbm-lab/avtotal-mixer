import { useEffect } from 'react'

export function ConfirmDialog({ config, onAction }) {
  if (!config) return null

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onAction('cancel')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onAction])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: 'var(--card)', borderRadius: 12, padding: '24px 28px',
        minWidth: 360, maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', gap: 16
      }}>
        {config.title && (
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
            {config.title}
          </div>
        )}
        <div style={{
          fontSize: 13, color: 'var(--text)', lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-all'
        }}>
          {config.message}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 4 }}>
          {config.buttons.map(btn => (
            <button
              key={btn.action}
              onClick={() => onAction(btn.action)}
              style={{
                padding: '7px 18px', borderRadius: 7, border: 'none',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: btn.color || '#888', color: '#fff',
                opacity: 1, transition: 'opacity 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.82'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
