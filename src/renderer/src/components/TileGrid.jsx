import { useEffect, useRef, useState } from 'react'
import TerminalTile from './TerminalTile'

function TileGrid() {
  const containerRef = useRef(null)
  const [layout, setLayout] = useState({ tiles: [], focusedId: null })

  useEffect(() => {
    // Subscribe to layout updates pushed from main whenever tile state changes.
    window.tile.onLayout((newLayout) => setLayout(newLayout))

    // ResizeObserver fires on mount and on every window resize.
    // Each time, we report real pixel dimensions to main so bounds stay accurate.
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      window.tile.resize(width, height)
    })

    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {layout.tiles.map((tile) => (
        <div
          key={tile.id}
          style={{
            position: 'absolute',
            left: tile.bounds.x,
            top: tile.bounds.y,
            width: tile.bounds.width,
            height: tile.bounds.height
          }}
        >
          {tile.type === 'terminal' && <TerminalTile />}
        </div>
      ))}
    </div>
  )
}

export default TileGrid
