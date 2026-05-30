import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'

function TerminalTile() {
  // containerRef gives us the real DOM node that xterm.open() requires.
  const containerRef = useRef(null)

  useEffect(() => {
    const terminal = new Terminal({ cursorBlink: true })
    const fitAddon = new FitAddon()

    terminal.loadAddon(fitAddon)

    // Attach xterm to the real DOM element.
    terminal.open(containerRef.current)

    // Size the terminal to fill its container (sets cols/rows from pixel dimensions).
    fitAddon.fit()

    // pty:data - subscribe to shell output from main process
    window.pty.onData((data) => terminal.write(data))

    // pty:write - send keystrokes to main process
    terminal.onData((data) => window.pty.write(data))

    // Clean up xterm when the component unmounts.
    return () => terminal.dispose()
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', backgroundColor: '#1e1e1e' }}
    />
  )
}

export default TerminalTile
