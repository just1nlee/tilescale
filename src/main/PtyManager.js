import { ipcMain } from 'electron'
import * as pty from 'node-pty'
import os from 'os'

class PtyManager {
  constructor() {
    this.processes = new Map()

    ipcMain.on('pty:write', (_event, { id, data }) => {
      this.processes.get(id)?.write(data)
    })

    // Renderer reports the terminal's pixel-grid size in cells. We forward it
    // to node-pty, which sets the kernel pty winsize and raises SIGWINCH so
    // the shell knows where to wrap lines.
    ipcMain.on('pty:resize', (_event, { id, cols, rows }) => {
      this.processes.get(id)?.resize(cols, rows)
    })
  }

  spawn(id, webContents) {
    // Idempotent: the renderer signals pty:ready from inside TerminalTile's
    // useEffect, which can fire twice in React StrictMode. Without this guard
    // we'd fork two shells per tile and the duplicate's output would interleave.
    if (this.processes.has(id)) return

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
