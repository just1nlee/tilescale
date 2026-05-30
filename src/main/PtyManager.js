import { ipcMain } from 'electron'
import * as pty from 'node-pty'
import os from 'os'

class PtyManager {
  constructor() {
    this.process = null
  }

  spawn(webContents) {
    const shell = process.env.SHELL || '/bin/zsh'

    this.process = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: os.homedir(),
      env: process.env
    })

    // pty:data - send shell output to renderer
    this.process.onData((data) => {
      webContents.send('pty:data', data)
    })

    // pty:write - listen for keystrokes from renderer, write to shell
    ipcMain.on('pty:write', (_event, data) => {
      this.process.write(data)
    })
  }

  kill() {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
  }
}

export default PtyManager
