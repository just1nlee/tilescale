import { ipcMain } from 'electron'

export default class ModeManager {
  constructor() {
    this.currentMode = 'TILE'
    this._webContents = null

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
  }
}
