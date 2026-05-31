import { useEffect, useRef } from 'react'
import TerminalTile from './TerminalTile'

function TileGrid({ layout, onTileClick }) {
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
      {layout.tiles.map((tile) => {
        const focused = tile.id === layout.focusedId
        return (
          <div
            key={tile.id}
            onClick={() => onTileClick?.(tile.id)}
            style={{
              position: 'absolute',
              left: tile.bounds.x,
              top: tile.bounds.y,
              width: tile.bounds.width,
              height: tile.bounds.height,
              boxSizing: 'border-box',
              padding: '10px',
              background: 'rgba(20, 20, 20, 0.55)',
              border: `1px solid ${focused ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: focused
                ? '0 0 0 1px rgba(255, 255, 255, 0.25), 0 8px 28px rgba(0, 0, 0, 0.45), 0 0 24px rgba(255, 255, 255, 0.08)'
                : '0 4px 16px rgba(0, 0, 0, 0.25)',
              transition: 'border-color 120ms ease, box-shadow 120ms ease',
            }}
          >
            {tile.type === 'terminal' && (
              <TerminalTile id={tile.id} isFocused={focused} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default TileGrid
