import { useEffect, useRef } from 'react'
import TerminalTile from './TerminalTile'

function TileGrid({ layout }) {
  const containerRef = useRef(null)

  useEffect(() => {
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
          {tile.type === 'terminal' && (
            <TerminalTile id={tile.id} isFocused={tile.id === layout.focusedId} />
          )}
        </div>
      ))}
    </div>
  )
}

export default TileGrid
