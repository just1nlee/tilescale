import { ipcMain } from 'electron'
import * as pty from 'node-pty'
import os from 'os'

class PtyManager {
  constructor() {
    this.processes = new Map()

    ipcMain.on('pty:write', (_event, { id, data }) => {
      this.processes.get(id)?.write(data)
    })
  }

  spawn(id, webContents) {
    const shell = process.env.SHELL || '/bin/zsh'

    const proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: os.homedir(),
      env: process.env
    })

    proc.onData((data) => {
      webContents.send('pty:data', { id, data })
    })

    this.processes.set(id, proc)
  }

  kill(id) {
    const proc = this.processes.get(id)
    if (proc) {
      proc.kill()
      this.processes.delete(id)
    }
  }

  killAll() {
    for (const [id] of this.processes) {
      this.kill(id)
    }
  }
}

export default PtyManager
