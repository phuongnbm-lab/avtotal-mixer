import { ipcMain, dialog, shell } from 'electron'
import { readdirSync, statSync, renameSync, existsSync } from 'fs'
import { join, extname, basename } from 'path'

function listMediaFiles(folder, extensions, includeSubfolders) {
  const extSet = new Set(extensions.map(e => e.toLowerCase()))
  const results = []
  try {
    if (!folder || !existsSync(folder)) return results

    if (includeSubfolders) {
      function walk(dir) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name)
          if (entry.isDirectory()) walk(full)
          else if (extSet.has(extname(entry.name).toLowerCase())) results.push(full)
        }
      }
      walk(folder)
    } else {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        if (entry.isFile() && extSet.has(extname(entry.name).toLowerCase())) {
          results.push(join(folder, entry.name))
        }
      }
    }
    results.sort((a, b) => basename(a).toLowerCase().localeCompare(basename(b).toLowerCase()))
  } catch {}
  return results
}

export function setupFileHandlers() {
  ipcMain.handle('dialog:openFiles', async (_, opts) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: opts.filters || [],
      title: opts.title || 'Select files'
    })
    return canceled ? [] : filePaths
  })

  ipcMain.handle('dialog:openFolder', async (_, opts) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: opts?.title || 'Select folder'
    })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('dialog:openFile', async (_, opts) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: opts.filters || [],
      title: opts.title || 'Select file'
    })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('fs:listMedia', (_, { folder, extensions, includeSubfolders }) => {
    return listMediaFiles(folder, extensions, includeSubfolders)
  })

  ipcMain.handle('fs:exists', (_, filePath) => existsSync(filePath))

  ipcMain.handle('fs:rename', (_, { oldPath, newPath }) => {
    renameSync(oldPath, newPath)
    return true
  })

  ipcMain.handle('shell:openPath', (_, filePath) => shell.openPath(filePath))
  ipcMain.handle('shell:openExternal', (_, url) => shell.openExternal(url))
}
