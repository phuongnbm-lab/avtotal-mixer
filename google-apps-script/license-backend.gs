// ═══════════════════════════════════════════════════════════════════════
// AVTotal Mixer — License Backend (Google Apps Script)
//
// Hướng dẫn deploy:
//   1. Vào https://script.google.com → New project
//   2. Paste toàn bộ file này vào editor
//   3. Sửa SHEET_ID, SHEET_NAME, HMAC_SECRET bên dưới
//   4. Deploy → New deployment → Web app
//      • Execute as: Me
//      • Who has access: Anyone
//   5. Copy URL deployment → paste vào APPS_SCRIPT_URL trong Electron & Python
//
// Cấu trúc Google Sheet (header row):
//   Machine ID | User | Expiry | Status
//   (tên cột linh hoạt — xem comment tại midIdx bên dưới)
// ═══════════════════════════════════════════════════════════════════════

const SHEET_ID   = 'YOUR_GOOGLE_SHEET_ID'   // ID từ URL Google Sheet
const SHEET_NAME = 'Sheet1'                  // Tên tab trong Sheet
const HMAC_SECRET = 'REPLACE_WITH_YOUR_SECRET_KEY'  // Phải giống hệt trong app

// ───────────────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents)
    const machine_id = (body.machine_id || '').trim()
    if (!machine_id) return sign({ ok: false, msg: 'Missing machine_id.' })

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME)
    const rows  = sheet.getDataRange().getValues()
    const hdrs  = rows[0].map(h => h.toString().toLowerCase().trim())

    // Flexible header matching
    const midIdx    = hdrs.findIndex(h => h.includes('machine') || h === 'mid' || h === 'id')
    const statusIdx = hdrs.findIndex(h => h.includes('status') || h.includes('trạng'))
    const userIdx   = hdrs.findIndex(h => h.includes('user')   || h.includes('email') || h.includes('tên'))
    const expiryIdx = hdrs.findIndex(h => h.includes('expiry') || h.includes('expired') || h.includes('hsd') || h.includes('ngày'))

    for (let i = 1; i < rows.length; i++) {
      const row    = rows[i]
      const rowMid = midIdx >= 0 && row[midIdx] ? row[midIdx].toString().trim() : ''
      if (rowMid.toLowerCase() !== machine_id.toLowerCase()) continue

      const status = statusIdx >= 0 && row[statusIdx]
        ? row[statusIdx].toString().trim().toUpperCase() : ''

      if (status === 'PENDING') {
        return sign({ ok: false, msg: 'Tài khoản đang chờ duyệt. Liên hệ admin để kích hoạt.' })
      }
      if (['OFF', 'INACTIVE', 'BLOCKED', 'LOCKED', 'EXPIRED', 'REMOVED', '0'].includes(status)) {
        return sign({ ok: false, msg: 'Tài khoản bị vô hiệu hoá hoặc đã hết hạn. Liên hệ admin để gia hạn.' })
      }

      const user   = userIdx   >= 0 && row[userIdx]   ? row[userIdx].toString().trim()   : ''
      const expiry = expiryIdx >= 0 && row[expiryIdx] ? row[expiryIdx].toString().trim() : ''
      return sign({ ok: true, user, expiry, msg: 'Kích hoạt thành công!' })
    }

    return sign({ ok: false, msg: 'Machine ID chưa được đăng ký. Liên hệ admin để kích hoạt.' })

  } catch (err) {
    return sign({ ok: false, msg: 'Lỗi server: ' + err.message })
  }
}

// Signs payload with HMAC-SHA256 and returns a JSON ContentService response
function sign(payload) {
  const ts     = Date.now()
  const ok     = !!payload.ok
  const user   = payload.user   || ''
  const expiry = payload.expiry || ''
  const msg    = payload.msg    || ''
  const message = `${ok}|${user}|${expiry}|${ts}`
  const sig = computeHmac(HMAC_SECRET, message)
  return ContentService
    .createTextOutput(JSON.stringify({ ok, user, expiry, msg, ts, sig }))
    .setMimeType(ContentService.MimeType.JSON)
}

function computeHmac(secret, message) {
  const bytes = Utilities.computeHmacSha256Signature(message, secret)
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('')
}
