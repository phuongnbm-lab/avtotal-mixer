import { useState, useEffect } from 'react'

export default function LicenseDialog({ onActivated, errorMsg }) {
  const [machineId, setMachineId] = useState('')
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    window.api.license.machineId().then(setMachineId)
  }, [])

  async function copyMachineId() {
    if (!machineId) return
    await navigator.clipboard.writeText(machineId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function contactAdmin() {
    await copyMachineId()
    const url = await window.api.license.contactUrl()
    window.api.shell.openExternal(url)
  }

  async function retry() {
    if (!machineId) return
    setChecking(true)
    setStatus('Checking...')
    const result = await window.api.license.verify(machineId)
    if (result.ok) {
      setStatus('✓ Activated successfully!')
      setTimeout(onActivated, 800)
    } else {
      setStatus(result.msg || 'Not yet activated.')
      setChecking(false)
    }
  }

  const msg = errorMsg || 'This software requires a valid license to use.'
  const isRevoked = errorMsg && errorMsg.includes('revoked')

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{
        background: 'var(--card)', borderRadius: 16, padding: '28px 32px', width: 440,
        border: '1px solid var(--border)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: '#F1EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🔑</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>AVTotal Mixer</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>License Activation</div>
          </div>
        </div>

        {/* Message */}
        <div style={{
          background: isRevoked ? '#FFF0F0' : '#F5F3FF',
          border: `1px solid ${isRevoked ? '#FFBDBD' : '#DDD8FF'}`,
          borderRadius: 8, padding: '10px 14px', fontSize: 13,
          color: isRevoked ? '#C0392B' : '#5A3DF0', marginBottom: 20
        }}>
          {msg}
        </div>

        {/* Machine ID */}
        {!isRevoked && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, letterSpacing: 0.5 }}>
              SEND THIS MACHINE ID TO ADMIN
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <div style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, background: 'var(--soft)',
                border: '1px solid var(--border)', fontSize: 12, fontFamily: 'monospace',
                color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {machineId || '...'}
              </div>
              <button onClick={copyMachineId} style={btnStyle(copied ? '#18C9B7' : '#5A3DF0')}>
                {copied ? '✓' : 'Copy'}
              </button>
              <button onClick={contactAdmin} style={btnStyle('#18C9B7')}>📱 Zalo</button>
            </div>
          </>
        )}

        {/* Status */}
        {status && (
          <div style={{
            padding: '8px 12px', borderRadius: 8, marginBottom: 14, fontSize: 13,
            background: status.startsWith('✓') ? '#EAFBF8' : '#FFF4EC',
            color: status.startsWith('✓') ? '#18C9B7' : '#B04000'
          }}>
            {status}
          </div>
        )}

        {/* Buttons */}
        {!isRevoked && (
          <button onClick={retry} disabled={checking || !machineId} style={{
            ...btnStyle('#5A3DF0'), width: '100%', padding: '11px 0', fontSize: 14,
            opacity: checking || !machineId ? 0.5 : 1
          }}>
            {checking ? 'Checking...' : '🔄 Retry'}
          </button>
        )}
      </div>
    </div>
  )
}

function btnStyle(bg) {
  return {
    background: bg, color: '#fff', border: 'none',
    borderRadius: 9, padding: '8px 16px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap'
  }
}
