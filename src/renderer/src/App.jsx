import { useState, useEffect } from 'react'
import TileGrid from './components/TileGrid'
import StatusBar from './components/StatusBar'

function App() {
  const [mode, setMode] = useState('TILE')
  const [layout, setLayout] = useState({ tiles: [], focusedId: null })

  useEffect(() => {
    window.mode.onChange((m) => setMode(m))
    window.tile.onLayout((l) => setLayout(l))
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        window.mode.toggle()
        return
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
      <StatusBar mode={mode} />
    </div>
  )
}

export default App
