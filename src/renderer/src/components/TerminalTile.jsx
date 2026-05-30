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

    // Detect Shift+Enter and toggle mode. Return true so xterm still generates
    // the \r via onData — we swallow it there before it reaches the PTY.
    let swallowNextCR = false
    terminal.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown' && e.shiftKey && e.key === 'Enter') {
        window.mode.toggle()
        swallowNextCR = true
      }
      return true
    })

    // pty:write - send keystrokes to main process, filtering the \r from Shift+Enter.
    terminal.onData((data) => {
      if (swallowNextCR && data === '\r') {
        swallowNextCR = false
        return
      }
      window.pty.write(data)
    })

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
