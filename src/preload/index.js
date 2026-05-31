import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

// PTY API — exposes exactly two channels to the renderer:
//   pty.onData(cb)  — subscribe to shell output
//   pty.write(data) — send a keystroke to the shell
const pty = {
  onData: (callback) => ipcRenderer.on('pty:data', (_event, { id, data }) => callback(id, data)),
  write: (id, data) => ipcRenderer.send('pty:write', { id, data })
}

// Tile API — exposes layout channels to the renderer:
//   tile.resize(w, h)   — report real window pixel dimensions to main
//   tile.onLayout(cb)   — subscribe to layout updates pushed from main
//   tile.spawn(type)    — ask main to create a new tile ('terminal' | 'browser')
//   tile.close(id)      — ask main to remove a tile by id
//   tile.focus(id)      — tell main which tile is now focused
const tile = {
  resize: (width, height) => ipcRenderer.send('tile:resize', { width, height }),
  onLayout: (callback) => ipcRenderer.on('tile:layout', (_event, layout) => callback(layout)),
  spawn: (type) => ipcRenderer.send('tile:spawn', type),
  close: (id) => ipcRenderer.send('tile:close', id),
  focus: (id) => ipcRenderer.send('tile:focus', id)
}

// Mode API — exposes INSERT/TILE mode channels to the renderer:
//   mode.toggle()       — ask main to flip the current mode
//   mode.onChange(cb)   — subscribe to mode updates pushed from main
const mode = {
  toggle: () => ipcRenderer.send('mode:toggle'),
  onChange: (callback) => ipcRenderer.on('mode:changed', (_event, m) => callback(m))
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
    contextBridge.exposeInMainWorld('mode', mode)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
  window.pty = pty
  window.tile = tile
  window.mode = mode
}
