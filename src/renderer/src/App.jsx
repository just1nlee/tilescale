import { useState, useEffect } from 'react'
import TileGrid from './components/TileGrid'

function App() {
  const [mode, setMode] = useState('TILE')

  useEffect(() => {
    window.mode.onChange((m) => {
      setMode(m)
      window.__mode = m
    })

  }, [])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <TileGrid />
    </div>
  )
}

export default App
