import { useState } from 'react'

// Must match BrowserManager.CHROME_HEIGHT in main: the native WebContentsView
// is positioned to start exactly this many pixels below the tile's content
// origin, leaving this strip for the chrome we draw here.
const CHROME_HEIGHT = 36

// Shared look for the three nav buttons.
const buttonStyle = {
  width: '24px',
  height: '24px',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '5px',
  color: '#f0f0f0',
  fontSize: '14px',
  lineHeight: 1,
  cursor: 'pointer',
  padding: 0
}

// BrowserTile draws only the URL bar. The live page is a native
// WebContentsView owned by the main process (see BrowserManager), floating on
// top of this React page directly below the chrome. The buttons/input call
// window.browser, which Piece 3 wires up via the preload bridge — until then
// the optional chaining keeps them inert instead of crashing.
function BrowserTile({ id }) {
  const [url, setUrl] = useState('')

  const submit = (e) => {
    e.preventDefault()
    window.browser?.navigate(id, url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div
        style={{
          height: `${CHROME_HEIGHT}px`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontFamily: 'monospace'
        }}
      >
        <button type="button" style={buttonStyle} onClick={() => window.browser?.back(id)}>
          ‹
        </button>
        <button type="button" style={buttonStyle} onClick={() => window.browser?.forward(id)}>
          ›
        </button>
        <button type="button" style={buttonStyle} onClick={() => window.browser?.reload(id)}>
          ⟳
        </button>
        <form onSubmit={submit} style={{ flex: 1, display: 'flex' }}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter URL"
            spellCheck={false}
            style={{
              flex: 1,
              height: '24px',
              boxSizing: 'border-box',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '5px',
              color: '#f0f0f0',
              fontSize: '12px',
              fontFamily: 'monospace',
              padding: '0 8px',
              outline: 'none'
            }}
          />
        </form>
      </div>

      {/* Empty placeholder: the native WebContentsView floats over this area. */}
      <div style={{ flex: 1 }} />
    </div>
  )
}

export default BrowserTile
