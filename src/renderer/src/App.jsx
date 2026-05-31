import { useState, useEffect } from 'react'
import TileGrid from './components/TileGrid'
import StatusBar from './components/StatusBar'

function App() {
  const [mode, setMode] = useState('TILE')

  useEffect(() => {
    window.mode.onChange((m) => {
      setMode(m)
      window.__mode = m
    })

    const handleKeyDown = (e) => {
      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        window.mode.toggle()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <TileGrid />
      </div>
      <StatusBar mode={mode} />
    </div>
  )
}

export default App
