import { useEffect, useRef } from 'react'
import TerminalTile from './TerminalTile'
import BrowserTile from './BrowserTile'

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

  const workspaces = layout.workspaces ?? {}
  const activeWorkspace = layout.activeWorkspace

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {Object.entries(workspaces).map(([wsId, ws]) => {
        const isActive = Number(wsId) === Number(activeWorkspace)
        return (
          <div
            key={wsId}
            style={{
              position: 'absolute',
              inset: 0,
              display: isActive ? 'block' : 'none'
            }}
          >
            {ws.tiles.map((tile) => {
              if (!tile.bounds) return null
              const focused = tile.id === ws.focusedId
              return (
                <div
                  key={tile.id}
                  onClick={() => isActive && onTileClick?.(tile.id)}
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
                    <TerminalTile id={tile.id} isFocused={isActive && focused} />
                  )}
                  {tile.type === 'browser' && <BrowserTile id={tile.id} />}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export default TileGrid
