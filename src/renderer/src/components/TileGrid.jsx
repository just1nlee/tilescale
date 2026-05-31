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

  const asciiArt = String.raw` _____ ___ _     _____ ____   ____    _    _     _____ 
|_   _|_ _| |   | ____/ ___| / ___|  / \  | |   | ____|
  | |  | || |   |  _| \___ \| |     / _ \ | |   |  _|  
  | |  | || |___| |___ ___) | |___ / ___ \| |___| |___ 
  |_| |___|_____|_____|____/ \____/_/   \_\_____|_____|`

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
            {isActive && ws.tiles.length === 0 && (
              <pre
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  margin: 0,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '16px',
                  lineHeight: 1.2,
                  whiteSpace: 'pre',
                  color: 'rgb(255, 255, 255)',
                  userSelect: 'none',
                  pointerEvents: 'none',
                  textShadow: '0 0 16px rgba(255, 255, 255, 0.12)'
                }}
              >
                {asciiArt}
              </pre>
            )}
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
                    transition: 'border-color 120ms ease, box-shadow 120ms ease'
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
