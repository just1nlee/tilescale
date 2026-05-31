import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'

function TerminalTile({ id, isFocused }) {
  // containerRef gives us the real DOM node that xterm.open() requires.
  const containerRef = useRef(null)
  const terminalRef = useRef(null)

  useEffect(() => {
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      allowTransparency: true,
      fontFamily: 'Menlo, Monaco, "SF Mono", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      letterSpacing: 0.3,
      theme: {
        background: 'rgba(0, 0, 0, 0)',
        foreground: '#f0f0f0',
        cursor: '#ffcf80',
        cursorAccent: 'rgba(20, 20, 20, 0.55)',
        selectionBackground: 'rgba(255, 255, 255, 0.18)',
        selectionInactiveBackground: 'rgba(255, 255, 255, 0.08)',
        black: '#1a1a1a',
        red: '#ff8a8a',
        green: '#a8e6a3',
        yellow: '#ffcf80',
        blue: '#9ec5ff',
        magenta: '#d8a8ff',
        cyan: '#9be7f0',
        white: '#f0f0f0',
        brightBlack: '#6b6b6b',
        brightRed: '#ffa5a5',
        brightGreen: '#c5f0bf',
        brightYellow: '#ffe0a8',
        brightBlue: '#bcd6ff',
        brightMagenta: '#e6c4ff',
        brightCyan: '#bff0f6',
        brightWhite: '#ffffff',
      }
    })
    const fitAddon = new FitAddon()

    terminal.loadAddon(fitAddon)

    // Attach xterm to the real DOM element.
    terminal.open(containerRef.current)

    // Size the terminal to fill its container (sets cols/rows from pixel dimensions).
    // Skip if the container is hidden (display:none → 0×0): fit() would yield
    // cols/rows of 0/NaN and node-pty would throw InvalidArgument on resize.
    // The ResizeObserver below catches up the moment the wrapper becomes visible.
    if (containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
      fitAddon.fit()
      window.pty.resize(id, terminal.cols, terminal.rows)
    }

    terminalRef.current = terminal

    terminal.attachCustomKeyEventHandler((e) => {
      if (e.shiftKey && e.key === 'Enter') return false
      return true
    })

    // pty:data - only render output belonging to this tile.
    const unsubscribe = window.pty.onData((tileId, data) => {
      if (tileId === id) terminal.write(data)
    })

    // Tell main it's safe to spawn the shell now. Doing this here — AFTER
    // onData is registered — closes the startup race where main would spawn
    // node-pty in ready-to-show, zsh would print its banner + first prompt,
    // and those bytes would arrive at the renderer before any pty:data
    // listener existed and be silently dropped.
    window.pty.ready(id)

    // pty:write - tag keystrokes with this tile's id so main routes to the right shell.
    terminal.onData((data) => {
      window.pty.write(id, data)
    })

    // Keep xterm and the kernel pty winsize in sync with the container's real
    // pixel size. Fires on window resize, on neighbor tile spawn/close, and
    // when the workspace flips back to visible at a new size.
    const observer = new ResizeObserver(() => {
      const el = containerRef.current
      if (!el) return
      // Hidden workspaces report 0×0 via display:none — don't shrink the pty.
      if (el.clientWidth === 0 || el.clientHeight === 0) return
      fitAddon.fit()
      window.pty.resize(id, terminal.cols, terminal.rows)
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
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
      style={{ width: '100%', height: '100%' }}
    />
  )
}

export default TerminalTile
