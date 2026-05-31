import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

// PTY API — exposes channels to the renderer:
//   pty.onData(cb)              — subscribe to shell output
//   pty.write(id, data)         — send a keystroke to the shell
//   pty.resize(id, cols, rows)  — report the terminal cell-grid size to main
const pty = {
  onData: (callback) => {
    const handler = (_event, { id, data }) => callback(id, data)
    ipcRenderer.on('pty:data', handler)
    return () => ipcRenderer.removeListener('pty:data', handler)
  },
  write: (id, data) => ipcRenderer.send('pty:write', { id, data }),
  resize: (id, cols, rows) => ipcRenderer.send('pty:resize', { id, cols, rows }),
  // Tells main "my pty:data listener is wired, safe to spawn the shell now".
  // Must be called AFTER onData() so the very first byte (zsh banner +
  // prompt) is delivered into xterm instead of dropped on the floor.
  ready: (id) => ipcRenderer.send('pty:ready', id)
}

// Tile API — exposes layout channels to the renderer:
//   tile.resize(w, h)   — report real window pixel dimensions to main
//   tile.onLayout(cb)   — subscribe to layout updates pushed from main
//   tile.spawn(type)    — ask main to create a new tile ('terminal' | 'browser')
//   tile.close(id)      — ask main to remove a tile by id
//   tile.focus(id)      — tell main which tile is now focused
const tile = {
  resize: (width, height) => ipcRenderer.send('tile:resize', { width, height }),
  onLayout: (callback) => {
    const handler = (_event, layout) => callback(layout)
    ipcRenderer.on('tile:layout', handler)
    return () => ipcRenderer.removeListener('tile:layout', handler)
  },
  spawn: (type) => ipcRenderer.send('tile:spawn', type),
  close: (id) => ipcRenderer.send('tile:close', id),
  focus: (id) => ipcRenderer.send('tile:focus', id),
  focusDirection: (dir) => ipcRenderer.send('tile:focus-direction', dir)
}

// Workspace API — exposes workspace switching to the renderer:
//   workspace.switch(id) — ask main to switch to workspace 1–5
const workspace = {
  switch: (id) => ipcRenderer.send('workspace:switch', id)
}

// Browser API — drives the native WebContentsView behind each browser tile:
//   browser.navigate(id, url)   — load a URL / search query in the tile
//   browser.back/forward(id)    — step through that tile's history
//   browser.reload(id)          — reload the current page
//   browser.requestState(id)    — ask main to (re)send current nav state
//   browser.onState(cb)         — subscribe to nav-state pushes (url, history, loading)
const browser = {
  navigate: (id, url) => ipcRenderer.send('browser:navigate', { id, url }),
  back: (id) => ipcRenderer.send('browser:back', id),
  forward: (id) => ipcRenderer.send('browser:forward', id),
  reload: (id) => ipcRenderer.send('browser:reload', id),
  requestState: (id) => ipcRenderer.send('browser:request-state', id),
  // Tell main when the URL bar gains/loses focus so it won't steal focus back
  // to the native page mid-type.
  setEditing: (id, editing) => ipcRenderer.send('browser:set-editing', { id, editing }),
  // Tell main to hide/show all native browser views while a React overlay (the
  // profile selector) is open, so it isn't occluded by views floating on top.
  setOverlay: (open) => ipcRenderer.send('browser:set-overlay', open),
  onState: (callback) => {
    const handler = (_event, state) => callback(state)
    ipcRenderer.on('browser:state', handler)
    return () => ipcRenderer.removeListener('browser:state', handler)
  }
}

// Mode API — exposes INSERT/TILE mode channels to the renderer:
//   mode.toggle()       — ask main to flip the current mode
//   mode.onChange(cb)   — subscribe to mode updates pushed from main
const mode = {
  toggle: () => ipcRenderer.send('mode:toggle'),
  onChange: (callback) => {
    const handler = (_event, m) => callback(m)
    ipcRenderer.on('mode:changed', handler)
    return () => ipcRenderer.removeListener('mode:changed', handler)
  }
}

// Profile API — exposes named saved-session switching to the renderer:
//   profile.onState(cb)  — subscribe to { profiles, activeId } pushes from main
//   profile.switch(id)   — ask main to swap the whole tile world to profile id
//   profile.create(name) — create a new (empty) profile and switch into it
const profile = {
  onState: (callback) => {
    const handler = (_event, state) => callback(state)
    ipcRenderer.on('profile:state', handler)
    return () => ipcRenderer.removeListener('profile:state', handler)
  },
  switch: (id) => ipcRenderer.send('profile:switch', id),
  create: (name) => ipcRenderer.send('profile:create', name),
  rename: (id, name) => ipcRenderer.send('profile:rename', { id, name }),
  remove: (id) => ipcRenderer.send('profile:delete', id)
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
    contextBridge.exposeInMainWorld('workspace', workspace)
    contextBridge.exposeInMainWorld('mode', mode)
    contextBridge.exposeInMainWorld('browser', browser)
    contextBridge.exposeInMainWorld('profile', profile)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
  window.pty = pty
  window.tile = tile
  window.workspace = workspace
  window.mode = mode
  window.browser = browser
  window.profile = profile
}
