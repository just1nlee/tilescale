import { useState, useEffect } from 'react'
import TileGrid from './components/TileGrid'
import StatusBar from './components/StatusBar'

function App() {
  const [mode, setMode] = useState('TILE')
  const [layout, setLayout] = useState({ tiles: [], focusedId: null })

  useEffect(() => {
    const unsubMode = window.mode.onChange((m) => setMode(m))
    const unsubLayout = window.tile.onLayout((l) => setLayout(l))
    return () => {
      unsubMode()
      unsubLayout()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        window.mode.toggle()
        return
      }

      // Handle macOS quit shortcut
      if (e.metaKey && e.key === 'q') return

      if (mode !== 'TILE') return

      e.preventDefault()
      e.stopPropagation()

      switch (e.key.toLowerCase()) {
        case 'b': window.tile.spawn('browser'); break
        case 't': window.tile.spawn('terminal'); break
        case 'q': if (layout.focusedId) window.tile.close(layout.focusedId); break
        case 'a': case 'h': case 'arrowleft': window.tile.focusDirection('a'); break
        case 'd': case 'l': case 'arrowright': window.tile.focusDirection('d'); break
        case '1': case '2': case '3': case '4': case '5':
          window.workspace.switch(parseInt(e.key)); break
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [mode, layout.focusedId])

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <TileGrid layout={layout} />
      </div>
      <StatusBar mode={mode} workspace={layout.activeWorkspace ?? 1} />
    </div>
  )
}

export default App
