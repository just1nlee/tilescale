import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'

function TerminalTile({ id, isFocused }) {
  // containerRef gives us the real DOM node that xterm.open() requires.
  const containerRef = useRef(null)
  const terminalRef = useRef(null)

  useEffect(() => {
    const terminal = new Terminal({ cursorBlink: true })
    const fitAddon = new FitAddon()

    terminal.loadAddon(fitAddon)

    // Attach xterm to the real DOM element.
    terminal.open(containerRef.current)

    // Size the terminal to fill its container (sets cols/rows from pixel dimensions).
    fitAddon.fit()

    terminalRef.current = terminal

    terminal.attachCustomKeyEventHandler((e) => {
      if (e.shiftKey && e.key === 'Enter') return false
      return true
    })

    // pty:data - only render output belonging to this tile.
    const unsubscribe = window.pty.onData((tileId, data) => {
      if (tileId === id) terminal.write(data)
    })

    // pty:write - tag keystrokes with this tile's id so main routes to the right shell.
    terminal.onData((data) => {
      window.pty.write(id, data)
    })

    return () => {
      unsubscribe()
      terminal.dispose()
    }
  }, [])

  // Give xterm real DOM focus whenever this tile becomes the focused tile.
  useEffect(() => {
    if (isFocused) terminalRef.current?.focus()
  }, [isFocused])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', backgroundColor: '#1e1e1e' }}
    />
  )
}

export default TerminalTile
