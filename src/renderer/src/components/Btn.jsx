import { useState } from 'react'

export default function Btn({ children, onClick, style, disabled, title }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'var(--soft)' : 'var(--soft)',
        border: '1px solid var(--btn-border)',
        color: 'var(--text)', borderRadius: 10,
        padding: '6px 14px', fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'all 0.15s',
        fontFamily: 'inherit',
        ...style
      }}
    >
      {children}
    </button>
  )
}
