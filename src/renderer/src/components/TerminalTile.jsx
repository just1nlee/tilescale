import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'

function TerminalTile({ id }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const terminal = new Terminal({ cursorBlink: true })
    const fitAddon = new FitAddon()

    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    fitAddon.fit()

    // Only write data addressed to this tile's ID.
    const unsubscribe = window.pty.onData((incomingId, data) => {
      if (incomingId === id) terminal.write(data)
    })

    let swallowNextCR = false
    terminal.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown' && e.shiftKey && e.key === 'Enter') {
        window.mode.toggle()
        swallowNextCR = true
      }
      return true
    })

    terminal.onData((data) => {
      if (swallowNextCR && data === '\r') {
        swallowNextCR = false
        return
      }
      window.pty.write(id, data)
    })

    return () => {
      unsubscribe()
      terminal.dispose()
    }
  }, [id])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', backgroundColor: '#1e1e1e' }}
    />
  )
}

export default TerminalTile
