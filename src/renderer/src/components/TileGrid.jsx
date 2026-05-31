import { useEffect, useRef, useState } from 'react'
import TerminalTile from './TerminalTile'

function TileGrid() {
  const containerRef = useRef(null)
  const [layout, setLayout] = useState({ tiles: [], focusedId: null })

  useEffect(() => {
    window.tile.onLayout((newLayout) => setLayout(newLayout))

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      window.tile.resize(width, height)
    })

    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {layout.tiles.map((tile) => {
        const isFocused = tile.id === layout.focusedId
        return (
          <div
            key={tile.id}
            onClick={() => window.tile.focus(tile.id)}
            style={{
              position: 'absolute',
              left: tile.bounds.x,
              top: tile.bounds.y,
              width: tile.bounds.width,
              height: tile.bounds.height,
              boxSizing: 'border-box',
              border: isFocused ? '2px solid #7aa2f7' : '2px solid #333',
              boxShadow: isFocused ? '0 0 8px #7aa2f7' : 'none',
            }}
          >
            {tile.type === 'terminal' && <TerminalTile id={tile.id} />}
          </div>
        )
      })}
    </div>
  )
}

export default TileGrid
