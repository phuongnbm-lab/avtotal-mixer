export function secToHMS(s) {
  s = Math.max(0, Math.round(s))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function secToMMSS(s) {
  s = Math.max(0, Math.round(s))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function shortenMiddle(text, maxLen = 52) {
  if (!text) return ''
  text = String(text)
  if (text.length <= maxLen) return text
  if (maxLen <= 3) return text.slice(0, maxLen)
  const keep = maxLen - 3
  const left = Math.floor(keep / 2)
  const right = keep - left
  return text.slice(0, left) + '...' + text.slice(-right)
}

export function basename(filePath) {
  if (!filePath) return ''
  return filePath.replace(/\\/g, '/').split('/').pop()
}

export function ext(filePath) {
  const b = basename(filePath)
  const i = b.lastIndexOf('.')
  return i >= 0 ? b.slice(i).toLowerCase() : ''
}

export function stem(filePath) {
  const b = basename(filePath)
  const i = b.lastIndexOf('.')
  return i >= 0 ? b.slice(0, i) : b
}

export function parseTimecode(val) {
  if (!val) return 0
  const s = String(val).trim().replace(',', '.')
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s)
  const parts = s.split(':').map(Number)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

export function parentDir(filePath) {
  if (!filePath) return ''
  const norm = filePath.replace(/\\/g, '/')
  const i = norm.lastIndexOf('/')
  return i >= 0 ? filePath.slice(0, i) : filePath
}
