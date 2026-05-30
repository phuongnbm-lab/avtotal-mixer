import { useState, useEffect } from 'react'
import { useLang } from '../LangContext'

const APP_TITLE = 'AVTotal Mixer'
const APP_VERSION = 'v260546'
const GITHUB_REPO = 'phuongnbm-lab/avtotal-mixer'

function daysLeft(dateStr) {
  if (!dateStr) return null
  const [dd, mm, yyyy] = dateStr.split('/')
  const exp = new Date(+yyyy, +mm - 1, +dd, 23, 59, 59)
  return Math.ceil((exp - Date.now()) / 86400000)
}

export default function TitleBar({ dark, onToggleDark, licenseInfo }) {
  const { t, toggleLang } = useLang()
  const [maximized, setMaximized] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [coffeeQr, setCoffeeQr] = useState('')
  const [showQr, setShowQr] = useState(false)
  const [updateStatus, setUpdateStatus] = useState('checking') // 'checking'|'latest'|'available'|'downloading'
  const [latestVersion, setLatestVersion] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [downloadPercent, setDownloadPercent] = useState(0)

  useEffect(() => {
    window.api.win.isMaximized().then(setMaximized)
    window.api.win.onMaximized(setMaximized)
    window.api.app.logoDataUrl().then(url => { if (url) setLogoUrl(url) })
    window.api.app.coffeeQrDataUrl().then(url => { if (url) setCoffeeQr(url) })

    fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      .then(r => r.json())
      .then(data => {
        const tag = data.tag_name?.replace(/^v/, '')
        if (!tag) { setUpdateStatus('latest'); return }
        setLatestVersion(tag)
        const asset = data.assets?.find(a => a.name.endsWith('.exe'))
        if (asset) setDownloadUrl(asset.browser_download_url)
        setUpdateStatus(tag > APP_VERSION.replace(/^v/, '') ? 'available' : 'latest')
      })
      .catch(() => setUpdateStatus('latest'))

    window.api.update?.onProgress(data => setDownloadPercent(data.percent))
  }, [])

  async function handleUpdate() {
    if (!downloadUrl || updateStatus !== 'available') return
    setUpdateStatus('downloading')
    setDownloadPercent(0)
    await window.api.update.download(downloadUrl)
  }

  function checkUpdate() {
    setUpdateStatus('checking')
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      .then(r => r.json())
      .then(data => {
        const tag = data.tag_name?.replace(/^v/, '')
        if (!tag) { setUpdateStatus('latest'); return }
        setLatestVersion(tag)
        const asset = data.assets?.find(a => a.name.endsWith('.exe'))
        if (asset) setDownloadUrl(asset.browser_download_url)
        setUpdateStatus(tag > APP_VERSION.replace(/^v/, '') ? 'available' : 'latest')
      })
      .catch(() => setUpdateStatus('latest'))
  }

  return (
    <>
      <div className="drag-region" style={{
        height: 46, display: 'flex', alignItems: 'center',
        background: dark ? '#0D0720' : '#FFFFFF',
        borderBottom: `1px solid ${dark ? '#2A1860' : '#E4DFFF'}`,
        paddingLeft: 16, paddingRight: 0, flexShrink: 0, userSelect: 'none'
      }}>
        {/* Left: logo + title + version */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {logoUrl
            ? <img src={logoUrl} alt="logo" style={{ width: 22, height: 22, flexShrink: 0, objectFit: 'contain' }} />
            : <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#5A3DF0', flexShrink: 0 }} />
          }
          <span style={{ fontWeight: 700, fontSize: 15, color: dark ? '#E8E4FF' : '#1A0E3C' }}>
            {APP_TITLE}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
            background: dark ? '#2A1B5C' : '#EDE8FF',
            color: dark ? '#A090F0' : '#5A3DF0'
          }}>
            {APP_VERSION}
          </span>

          {/* Update button — always visible */}
          <button
            className="no-drag"
            onClick={
              updateStatus === 'available' ? handleUpdate :
              updateStatus === 'latest' ? checkUpdate : undefined
            }
            style={{
              display: 'flex', alignItems: 'center',
              padding: '3px 8px', borderRadius: 5, border: 'none',
              transition: 'all 0.2s',
              ...(updateStatus === 'available' ? {
                background: 'linear-gradient(135deg, #22c55e, #15803d)',
                color: '#fff', fontSize: 11, fontWeight: 700, gap: 4,
                cursor: 'pointer',
                animation: 'glow-update 1.2s ease-in-out infinite',
              } : updateStatus === 'downloading' ? {
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#fff', fontSize: 11, fontWeight: 700, gap: 4,
                cursor: 'default',
              } : {
                background: 'transparent',
                color: dark ? '#4A4870' : '#C5BFE0',
                fontSize: 14, cursor: updateStatus === 'latest' ? 'pointer' : 'default',
              })
            }}
            title={
              updateStatus === 'available'  ? `Cài v${latestVersion} tự động` :
              updateStatus === 'downloading' ? 'Đang tải...' :
              updateStatus === 'checking'   ? 'Đang kiểm tra...' :
              'Đang dùng bản mới nhất — click để kiểm tra lại'
            }
          >
            {updateStatus === 'downloading' ? `⬇ ${downloadPercent}%` :
             updateStatus === 'available'   ? '⬆ Update' : '🔄'}
          </button>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* License info */}
        {licenseInfo?.user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: dark ? '#C0BAE8' : '#5A3DF0',
              padding: '2px 8px', borderRadius: 4,
              background: dark ? '#1E1248' : '#EDE8FF'
            }}>
              {licenseInfo.user}
            </span>
            {licenseInfo.vip && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: '#fff', padding: '2px 8px', borderRadius: 4,
                background: '#F5A623'
              }}>★ VIP</span>
            )}
            {licenseInfo.expiry_date && (() => {
              const days = daysLeft(licenseInfo.expiry_date)
              const danger = days !== null && days <= 5
              const warn   = days !== null && days <= 10 && !danger
              return (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: danger ? '#C0392B' : warn ? '#E07B00' : (dark ? '#7EC8A0' : '#18A87A'),
                  padding: '2px 8px', borderRadius: 4,
                  background: danger ? (dark ? '#2A0000' : '#FFEAEA') : warn ? (dark ? '#2A1800' : '#FFF4E0') : (dark ? '#0D2A1E' : '#E6FAF4')
                }}>
                  Exp: {licenseInfo.expiry_date}{days !== null ? ` (${days} days)` : ''}
                </span>
              )
            })()}
            {!licenseInfo.expiry_date && (
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: dark ? '#7EC8A0' : '#18A87A',
                padding: '2px 8px', borderRadius: 4,
                background: dark ? '#0D2A1E' : '#E6FAF4'
              }}>Lifetime</span>
            )}
          </div>
        )}

        {/* Buy Me Coffee button */}
        {coffeeQr && (
          <button
            className="no-drag"
            onClick={() => setShowQr(true)}
            title="Support the author ☕"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, padding: '4px 10px', borderRadius: 8,
              color: dark ? '#F5A623' : '#B87333',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = dark ? '#1E1248' : '#FFF8EE'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            ☕ Support
          </button>
        )}

        {/* Lang toggle */}
        <button
          className="no-drag"
          onClick={toggleLang}
          style={{
            background: 'none', border: '1px solid', cursor: 'pointer',
            fontSize: 11, padding: '3px 9px', borderRadius: 6, fontWeight: 700,
            color: dark ? '#9A97B0' : '#7D7A8C',
            borderColor: dark ? '#3A3760' : '#E0DAEF',
            transition: 'background 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = dark ? '#1E1248' : '#F0EDFF'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          {t.langBtn}
        </button>

        {/* Theme toggle */}
        <button
          className="no-drag"
          onClick={onToggleDark}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, padding: '4px 10px', borderRadius: 8,
            color: dark ? '#9A97B0' : '#7D7A8C',
            transition: 'background 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = dark ? '#1E1248' : '#F0EDFF'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          {dark ? t.lightMode : t.darkMode}
        </button>

        {/* Window controls */}
        <div className="no-drag" style={{ display: 'flex' }}>
          <WinBtn icon="─" title="Minimize" onClick={() => window.api.win.minimize()} dark={dark} />
          <WinBtn icon={maximized ? '❐' : '□'} title={maximized ? 'Restore' : 'Maximize'} onClick={() => window.api.win.maximize()} dark={dark} />
          <WinBtn icon="✕" title="Close" onClick={() => window.api.win.close()} dark={dark} isClose />
        </div>
      </div>

      <style>{`
        @keyframes glow-update {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(34,197,94,0.7); }
          50%       { opacity: 0.75; box-shadow: 0 0 18px rgba(34,197,94,1), 0 0 30px rgba(34,197,94,0.5); }
        }
      `}</style>

      {/* Coffee QR Modal */}
      {showQr && coffeeQr && (
        <div
          onClick={() => setShowQr(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(10,6,30,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#12082A',
              borderRadius: 20,
              padding: '28px 28px 22px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              width: 310,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
              border: '1px solid rgba(255,255,255,0.07)'
            }}
          >
            {/* Coffee icon */}
            <div style={{ fontSize: 38, marginBottom: 10 }}>☕</div>

            {/* Title */}
            <div style={{ fontWeight: 800, fontSize: 20, color: '#FFFFFF', marginBottom: 10, textAlign: 'center' }}>
              Support the author
            </div>

            {/* Description */}
            <div style={{ fontSize: 12, color: '#8C84A8', textAlign: 'center', lineHeight: 1.6, marginBottom: 14 }}>
              If the app is useful, buy the author a coffee ☕
              <br />— scan the QR code below to transfer.
            </div>

            {/* QR image card */}
            <div style={{
              background: '#FFFFFF', borderRadius: 12, padding: 10,
              width: '100%', display: 'flex', justifyContent: 'center',
              marginBottom: 12
            }}>
              <img src={coffeeQr} alt="QR Code" style={{ width: 230, height: 'auto', display: 'block' }} />
            </div>

            {/* Below QR hint */}
            <div style={{ fontSize: 11, color: '#6B6385', marginBottom: 6, textAlign: 'center' }}>
              Scan to buy me a coffee!
            </div>

            {/* Thank you */}
            <div style={{ fontSize: 13, fontWeight: 700, color: '#FF5C6A', marginBottom: 10, textAlign: 'center' }}>
              Thank you so much! ❤
            </div>

            {/* Payment methods */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8, fontSize: 12, fontWeight: 700 }}>
              <span style={{ color: '#AE2070' }}>MoMo</span>
              <span style={{ color: '#4A4A4A', fontSize: 10 }}>·</span>
              <span style={{ color: '#00B4B4' }}>VietQR</span>
              <span style={{ color: '#4A4A4A', fontSize: 10 }}>·</span>
              <span style={{ color: '#1565C0' }}>Napas 247</span>

            </div>

            {/* Author info */}
            <div style={{ fontSize: 11, color: '#6B6385', marginBottom: 18, textAlign: 'center' }}>
              Author: <span style={{ color: '#9A97B0' }}>Bá Phương</span>
              {' · '}Zalo: <span style={{ color: '#18C9B7' }}>0904066020</span>
            </div>

            {/* Close button */}
            <button
              onClick={() => setShowQr(false)}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: '#C0BAD8', fontWeight: 600, fontSize: 13,
                cursor: 'pointer', transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function WinBtn({ icon, title, onClick, dark, isClose }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 46, height: 46, border: 'none', cursor: 'pointer',
        background: hovered ? (isClose ? '#C42B1C' : dark ? '#1E1248' : '#F0EDFF') : 'transparent',
        color: hovered && isClose ? '#fff' : (dark ? '#E8E4FF' : '#1A0E3C'),
        fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s, color 0.15s'
      }}
    >
      {icon}
    </button>
  )
}
