import { ipcMain, app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

function getStateFile() {
  return join(app.getPath('userData'), 'app_state.json')
}

function getBookmarksFile() {
  return join(app.getPath('userData'), 'bookmarked_folders.json')
}

function loadState() {
  try {
    const f = getStateFile()
    if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'))
  } catch {}
  return {}
}

function saveState(data) {
  try {
    writeFileSync(getStateFile(), JSON.stringify(data, null, 2), 'utf8')
  } catch {}
}

function loadBookmarks() {
  try {
    const f = getBookmarksFile()
    if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'))
  } catch {}
  return []
}

function saveBookmarks(data) {
  try {
    writeFileSync(getBookmarksFile(), JSON.stringify(data, null, 2), 'utf8')
  } catch {}
}

export function setupStateHandlers() {
  ipcMain.handle('state:load', () => loadState())
  ipcMain.handle('state:save', (_, data) => { saveState(data); return true })
  ipcMain.handle('bookmarks:load', () => loadBookmarks())
  ipcMain.handle('bookmarks:save', (_, data) => { saveBookmarks(data); return true })
}
