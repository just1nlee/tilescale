import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

// PTY API — exposes exactly two channels to the renderer:
//   pty.onData(cb)  — subscribe to shell output
//   pty.write(data) — send a keystroke to the shell
const pty = {
  onData: (callback) => ipcRenderer.on('pty:data', (_event, data) => callback(data)),
  write: (data) => ipcRenderer.send('pty:write', data)
}


// Tile API — exposes layout channels to the renderer:
//   tile.resize(w, h)   — report real window pixel dimensions to main
//   tile.onLayout(cb)   — subscribe to layout updates pushed from main
const tile = {
  resize: (width, height) => ipcRenderer.send('tile:resize', { width, height }),
  onLayout: (callback) => ipcRenderer.on('tile:layout', (_event, layout) => callback(layout))
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('pty', pty)
    contextBridge.exposeInMainWorld('tile', tile)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
  window.pty = pty
  window.tile = tile
}
