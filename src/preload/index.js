import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Window controls
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    maximize: () => ipcRenderer.send('win:maximize'),
    close: () => ipcRenderer.send('win:close'),
    forceClose: () => ipcRenderer.send('win:forceClose'),
    isMaximized: () => ipcRenderer.invoke('win:isMaximized'),
    onMaximized: (cb) => ipcRenderer.on('win:maximized', (_, val) => cb(val)),
    onAskClose: (cb) => ipcRenderer.on('app:askClose', cb),
    setSize: (h) => ipcRenderer.invoke('win:setSize', h)
  },

  // FFmpeg
  ffmpeg: {
    duration: (filePath) => ipcRenderer.invoke('ffmpeg:duration', filePath),
    hasAudio: (filePath) => ipcRenderer.invoke('ffmpeg:hasAudio', filePath),
    detectGpu: () => ipcRenderer.invoke('ffmpeg:detectGpu'),
    clearDurationCache: (filePath) => ipcRenderer.invoke('ffmpeg:clearDurationCache', filePath),
    render: (opts) => ipcRenderer.invoke('ffmpeg:render', opts),
    cancel: (renderId) => ipcRenderer.send('ffmpeg:cancel', renderId),
    onProgress: (cb) => ipcRenderer.on('ffmpeg:progress', (_, data) => cb(data)),
    onJobDone: (cb) => ipcRenderer.on('ffmpeg:jobDone', (_, data) => cb(data)),
    removeListeners: () => {
      ipcRenderer.removeAllListeners('ffmpeg:progress')
      ipcRenderer.removeAllListeners('ffmpeg:jobDone')
    }
  },

  // License
  license: {
    machineId: () => ipcRenderer.invoke('license:machineId'),
    verify: (mid) => ipcRenderer.invoke('license:verify', mid),
    contactUrl: () => ipcRenderer.invoke('license:contactUrl')
  },

  // State
  state: {
    load: () => ipcRenderer.invoke('state:load'),
    save: (data) => ipcRenderer.invoke('state:save', data)
  },

  // Bookmarks
  bookmarks: {
    load: () => ipcRenderer.invoke('bookmarks:load'),
    save: (data) => ipcRenderer.invoke('bookmarks:save', data)
  },

  // Dialogs & FS
  dialog: {
    openFiles: (opts) => ipcRenderer.invoke('dialog:openFiles', opts),
    openFolder: (opts) => ipcRenderer.invoke('dialog:openFolder', opts),
    openFile: (opts) => ipcRenderer.invoke('dialog:openFile', opts)
  },
  fs: {
    listMedia: (opts) => ipcRenderer.invoke('fs:listMedia', opts),
    exists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
    rename: (opts) => ipcRenderer.invoke('fs:rename', opts)
  },
  shell: {
    openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
  },
  app: {
    resourcesPath: () => ipcRenderer.invoke('app:resourcesPath'),
    logoDataUrl: () => ipcRenderer.invoke('app:logoDataUrl'),
    soundDataUrl: (filename) => ipcRenderer.invoke('app:soundDataUrl', filename),
    coffeeQrDataUrl: () => ipcRenderer.invoke('app:coffeeQrDataUrl'),
    splashDone: () => ipcRenderer.send('app:splashDone')
  },

  update: {
    download: (url) => ipcRenderer.invoke('update:download', url),
    onProgress: (cb) => ipcRenderer.on('update:progress', (_, data) => cb(data))
  }
})
