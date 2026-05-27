import { ipcMain, app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { networkInterfaces, hostname } from 'os'
import { v5 as uuidv5 } from 'uuid'
import https from 'https'

const CONTACT_URL = 'https://zalo.me/0904066020'

// Google Sheet → File → Share → Publish to web → Sheet → CSV → copy link
const STATUS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQepTH-Juu0EPa_qYJyC-z-oAIblJ3B00nO3OFUAMphfrPeoQ0RmNF4enL0zwrmbBU4IH6YBrbXFqz-/pub?gid=859949983&single=true&output=csv'

// Nếu offline, dùng cache trong N ngày
const CACHE_DAYS = 7

function getLicenseFile() {
  return join(app.getPath('userData'), 'license.dat')
}

function getMachineId() {
  const nets = networkInterfaces()
  let mac = ''
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
        mac = net.mac; break
      }
    }
    if (mac) break
  }
  return uuidv5(`${mac}|${hostname()}`, uuidv5.DNS)
}

function loadCache() {
  try {
    const f = getLicenseFile()
    if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'))
  } catch {}
  return {}
}

function saveCache(data) {
  try {
    writeFileSync(getLicenseFile(), JSON.stringify(data, null, 2), 'utf8')
  } catch {}
}

function fetchText(url, timeoutMs = 6000) {
  return new Promise(resolve => {
    const req = https.get(url, { timeout: timeoutMs }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); fetchText(res.headers.location, timeoutMs).then(resolve); return
      }
      let data = ''; res.on('data', c => { data += c }); res.on('end', () => resolve(data))
    })
    req.on('error', () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
  })
}

function parseExpiry(str) {
  if (!str) return null
  // Hỗ trợ DD/MM/YYYY và YYYY-MM-DD
  let d
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [dd, mm, yyyy] = str.split('/')
    d = new Date(+yyyy, +mm - 1, +dd, 23, 59, 59, 999)
  } else {
    d = new Date(str); d.setHours(23, 59, 59, 999)
  }
  return isNaN(d.getTime()) ? null : d
}

// Kiểm tra sheet, trả về {ok, msg, user, expiry_date} hoặc null nếu offline
async function checkSheet(machineId) {
  const csv = await fetchText(STATUS_CSV_URL)
  if (!csv) return null   // offline

  const lines = csv.split('\n')
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''))
  const midIdx    = headers.findIndex(h => h.includes('machine') || h.includes('uuid') || h === 'id')
  const statusIdx = headers.findIndex(h => h.includes('status'))
  const expiryIdx = headers.findIndex(h => h.includes('expir') || h.includes('hsd'))
  const userIdx   = headers.findIndex(h => h.includes('user') || h.includes('tên'))
  const vipIdx    = headers.findIndex(h => h === 'vip')

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const rowMid = cols[midIdx] || ''
    if (rowMid.toLowerCase() !== machineId.toLowerCase()) continue

    const status  = (cols[statusIdx] || '').trim().toUpperCase()
    const expStr  = (cols[expiryIdx] || '').trim()
    const user    = (cols[userIdx]   || '').trim()
    const vipRaw  = (cols[vipIdx]    || '').trim().toUpperCase()
    const vip     = vipRaw === 'TRUE' || vipRaw === '1' || vipRaw === 'YES'

    if (status !== 'ON') {
      return { ok: false, msg: 'License has been revoked. Contact admin.' }
    }

    if (expStr) {
      const exp = parseExpiry(expStr)
      if (exp && exp < new Date()) {
        return { ok: false, msg: `License expired on ${expStr}. Contact admin to renew.` }
      }
    }

    return { ok: true, msg: 'OK', user, expiry_date: expStr, vip }
  }

  return { ok: false, msg: 'Machine ID not registered. Send your ID to admin for activation.' }
}

// Gọi mỗi lần khởi động: online → check sheet và cache; offline → dùng cache
async function verifyLicense(machineId) {
  const online = await checkSheet(machineId)

  if (online !== null) {
    // Lưu cache kết quả mới nhất
    saveCache({ machine_id: machineId, last_check: Date.now(), ...online })
    return online
  }

  // Offline — dùng cache
  const cache = loadCache()
  if (cache.machine_id === machineId && cache.last_check) {
    const ageDays = (Date.now() - cache.last_check) / 86400000
    if (ageDays <= CACHE_DAYS && cache.ok) {
      return { ok: true, msg: 'OK (offline cache)', user: cache.user, expiry_date: cache.expiry_date, vip: cache.vip || false }
    }
    if (!cache.ok) return { ok: false, msg: cache.msg || 'License invalid.' }
  }

  // Không có cache hoặc quá hạn → vẫn cho qua (offline-first)
  return { ok: true, msg: 'OK (offline)' }
}

export function setupLicenseHandlers() {
  ipcMain.handle('license:machineId', () => getMachineId())
  ipcMain.handle('license:verify', async (_, machineId) => verifyLicense(machineId))
  ipcMain.handle('license:contactUrl', () => CONTACT_URL)
}
