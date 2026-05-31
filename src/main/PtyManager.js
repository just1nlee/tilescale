import { ipcMain } from 'electron'
import * as pty from 'node-pty'
import os from 'os'

class PtyManager {
  constructor() {
    this.processes = new Map() // tileId → pty process

    // Registered once. Routes keystrokes to the correct shell by tile ID.
    ipcMain.on('pty:write', (_event, { id, data }) => {
      this.processes.get(id)?.write(data)
    })
  }

  // Spawns a shell for the given tile ID and streams its output back tagged with that ID.
  spawn(id, webContents) {
    const shell = process.env.SHELL || '/bin/zsh'

    const process = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: os.homedir(),
      env: process.env
    })

    process.onData((data) => {
      webContents.send('pty:data', { id, data })
    })

    this.processes.set(id, process)
  }

  // Kills the shell for a single tile (called when that tile is closed).
  kill(id) {
    const process = this.processes.get(id)
    if (process) {
      process.kill()
      this.processes.delete(id)
    }
  }

  // Kills all shells (called on app quit).
  killAll() {
    for (const [id] of this.processes) {
      this.kill(id)
    }
  }
}

export default PtyManager
