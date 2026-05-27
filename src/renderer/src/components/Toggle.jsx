export default function Toggle({ label, checked, color = '#5A3DF0', onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
      <span
        onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer', flexShrink: 0,
          background: checked ? color : 'var(--border)',
          transition: 'background 0.2s'
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2, width: 16, height: 16,
          borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s'
        }} />
      </span>
      <span onClick={() => onChange(!checked)} style={{ fontSize: 12, color: checked ? 'var(--text)' : 'var(--muted)' }}>
        {label}
      </span>
    </label>
  )
}
