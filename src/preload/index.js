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

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('pty', pty)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
  window.pty = pty
}
