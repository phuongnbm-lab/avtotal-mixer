import { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeImage, net } from 'electron'
import { join } from 'path'
import { readFileSync, createWriteStream, unlinkSync } from 'fs'
import { spawn } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupFFmpegHandlers } from './ffmpeg.js'
import { setupLicenseHandlers } from './license.js'
import { setupStateHandlers } from './state.js'
import { setupFileHandlers } from './files.js'

function createSplash() {
  const splashPath = is.dev
    ? join(app.getAppPath(), 'resources', 'Splash.png')
    : join(process.resourcesPath, 'Splash.png')

  let b64
  try { b64 = readFileSync(splashPath).toString('base64') } catch { return null }

  const splash = new BrowserWindow({
    width: 720, height: 450,
    frame: false, resizable: false, center: true,
    skipTaskbar: true, alwaysOnTop: true,
    backgroundColor: '#000000',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })

  const html = Buffer.from(
    `<!DOCTYPE html><html><body style="margin:0;overflow:hidden;background:#000">` +
    `<img src="data:image/png;base64,${b64}" style="width:100%;height:100%;object-fit:cover;display:block">` +
    `</body></html>`
  ).toString('base64')

  splash.loadURL(`data:text/html;base64,${html}`)
  return splash
}

function createWindow(splash) {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 700,
    minWidth: 1100,
    minHeight: 640,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#F6F5FB',
    icon: is.dev
      ? join(app.getAppPath(), '..', 'Logo.ico')
      : join(process.resourcesPath, 'Logo.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  function showMain() {
    if (splash && !splash.isDestroyed()) splash.close()
    mainWindow.show()
    mainWindow.focus()
  }

  ipcMain.once('app:splashDone', showMain)
  setTimeout(() => { if (!mainWindow.isVisible()) showMain() }, 12000)

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // App info
  ipcMain.handle('app:resourcesPath', () =>
    is.dev ? join(app.getAppPath(), '..') : process.resourcesPath
  )

  ipcMain.handle('app:coffeeQrDataUrl', () => {
    const imgPath = is.dev
      ? join(app.getAppPath(), 'resources', 'Buy me a Coffee.png')
      : join(process.resourcesPath, 'Buy me a Coffee.png')
    try {
      const data = readFileSync(imgPath)
      return `data:image/png;base64,${data.toString('base64')}`
    } catch {
      return null
    }
  })

  ipcMain.handle('app:soundDataUrl', (_, filename) => {
    const soundPath = is.dev
      ? join(app.getAppPath(), 'resources', filename)
      : join(process.resourcesPath, filename)
    try {
      const ext = filename.split('.').pop().toLowerCase()
      const mime = ext === 'mp3' ? 'audio/mpeg' : `audio/${ext}`
      const data = readFileSync(soundPath)
      return `data:${mime};base64,${data.toString('base64')}`
    } catch {
      return null
    }
  })

  ipcMain.handle('app:logoDataUrl', () => {
    const logoPath = is.dev
      ? join(app.getAppPath(), '..', 'Logo.ico')
      : join(process.resourcesPath, 'Logo.ico')
    try {
      return nativeImage.createFromPath(logoPath).toDataURL()
    } catch {
      return null
    }
  })

  // Window control IPC
  let allowClose = false

  mainWindow.on('close', (e) => {
    if (!allowClose) {
      e.preventDefault()
      mainWindow.webContents.send('app:askClose')
    }
  })

  ipcMain.on('win:forceClose', () => {
    allowClose = true
    mainWindow.close()
  })

  ipcMain.on('win:minimize', () => mainWindow.minimize())
  ipcMain.on('win:maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('win:close', () => mainWindow.close())
  ipcMain.handle('win:isMaximized', () => mainWindow.isMaximized())
  ipcMain.handle('win:setSize', (_, h) => {
    if (mainWindow.isMaximized()) return
    const [w] = mainWindow.getSize()
    mainWindow.setSize(w, Math.round(h), true)
  })

  // Auto-update: download installer + run silently
  ipcMain.handle('update:download', async (_event, downloadUrl) => {
    const win = BrowserWindow.getAllWindows()[0]
    const tmpPath = join(app.getPath('temp'), 'AVTotalMixerUpdate.exe')
    const exePath = app.isPackaged ? app.getPath('exe') : null

    try {
      await new Promise((resolve, reject) => {
        const request = net.request(downloadUrl)
        const file = createWriteStream(tmpPath)
        let done = 0, total = 0

        request.on('response', (response) => {
          total = parseInt(response.headers['content-length'] || '0')
          response.on('data', (chunk) => {
            done += chunk.length
            file.write(chunk)
            if (total > 0) win?.webContents.send('update:progress', {
              percent: Math.round((done / total) * 100)
            })
          })
          response.on('end', () => file.close(resolve))
          response.on('error', (err) => { file.close(); reject(err) })
        })
        request.on('error', (err) => { file.close(); reject(err) })
        request.end()
      })

      const safe = (s) => s.replace(/'/g, "''")
      // -Verb RunAs triggers UAC elevation; -Wait doesn't work across elevation boundary,
      // so we use Sleep to give the NSIS installer time to finish before relaunching.
      const psCmd = exePath
        ? `Start-Process -FilePath '${safe(tmpPath)}' -ArgumentList '/S' -Verb RunAs; Start-Sleep -Seconds 25; Start-Process -FilePath '${safe(exePath)}'`
        : `Start-Process -FilePath '${safe(tmpPath)}' -ArgumentList '/S' -Verb RunAs`

      spawn('powershell.exe', ['-WindowStyle', 'Hidden', '-NonInteractive', '-Command', psCmd], {
        detached: true, stdio: 'ignore'
      }).unref()

      setTimeout(() => app.quit(), 800)
      return { success: true }
    } catch (err) {
      try { unlinkSync(tmpPath) } catch {}
      return { success: false, error: err.message }
    }
  })

  mainWindow.on('maximize', () => mainWindow.webContents.send('win:maximized', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('win:maximized', false))

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('PhuongNBM.AVTotalMixer')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupFFmpegHandlers()
  setupLicenseHandlers()
  setupStateHandlers()
  setupFileHandlers()

  const splash = createSplash()
  createWindow(splash)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(null)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
