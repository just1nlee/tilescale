import { ipcMain } from 'electron'

export default class ModeManager {
  constructor() {
    this.currentMode = 'TILE'
    this._webContents = null
    // Optional hook so main can re-sync native focus when the mode flips.
    this.onChange = null

    ipcMain.on('mode:toggle', () => this.toggle())
  }

  // Call this once the BrowserWindow exists so we have a target to broadcast to.
  attach(webContents) {
    this._webContents = webContents
    // Send initial mode so the renderer doesn't have to guess.
    this._webContents.send('mode:changed', this.currentMode)
  }

  toggle() {
    this.currentMode = this.currentMode === 'TILE' ? 'INSERT' : 'TILE'
    this._webContents?.send('mode:changed', this.currentMode)
    this.onChange?.(this.currentMode)
  }

  // Adopt a specific mode from a restored session. Called before attach(), so
  // the broadcast/onChange below are typically no-ops (no webContents/hook yet)
  // and attach() ends up sending the correct initial mode. Ignores junk values.
  setMode(mode) {
    if (mode !== 'TILE' && mode !== 'INSERT') return
    this.currentMode = mode
    this._webContents?.send('mode:changed', this.currentMode)
    this.onChange?.(this.currentMode)
  }
}
