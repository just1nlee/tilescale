// Full-screen keybind reference. Toggled with `?` from TILE mode. Like the
// profile selector, it renders above everything and relies on the parent
// asking main to hide native WebContentsView overlays while it is open —
// otherwise browser tiles would composite on top of it.

const SECTIONS = [
  {
    title: 'Global',
    hint: 'works even when Tilescale is hidden',
    binds: [['Option + Space', 'Toggle Tilescale visibility']]
  },
  {
    title: 'APP LEVEL',
    hint: 'works from either mode',
    binds: [['Shift + Space', 'Toggle INSERT ↔ TILE mode']]
  },
  {
    title: 'TILE mode',
    binds: [
      ['A  H  ←', 'Focus tile to the left'],
      ['D  L  →', 'Focus tile to the right'],
      ['B', 'Spawn new browser tile'],
      ['T', 'Spawn new terminal tile'],
      ['Q', 'Close focused tile'],
      ['1 – 5', 'Switch to workspace 1–5'],
      ['P', 'Open profile selector'],
      ['?', 'Toggle this help menu']
    ]
  }
]

function Key({ children }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '12px',
        fontWeight: 600,
        color: 'rgba(255, 255, 255, 0.92)',
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        borderRadius: '5px',
        padding: '3px 8px',
        whiteSpace: 'nowrap'
      }}
    >
      {children}
    </span>
  )
}

function HelpMenu({ onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 88vw)',
          maxHeight: '82vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
          padding: '24px 28px',
          background: 'rgba(20, 20, 20, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '14px',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.55)',
          color: 'rgba(255, 255, 255, 0.85)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '2.5px',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.55)'
            }}
          >
            Keybinds
          </h2>
          <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>
            press esc or ? to close
          </span>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.title} style={{ marginBottom: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '8px',
                marginBottom: '10px'
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                  color: 'rgba(255, 255, 255, 0.75)'
                }}
              >
                {section.title}
              </span>
              {section.hint && (
                <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.35)' }}>
                  {section.hint}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {section.binds.map(([keys, desc]) => (
                <div
                  key={keys}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <div style={{ width: '120px', flexShrink: 0 }}>
                    <Key>{keys}</Key>
                  </div>
                  <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)' }}>
                    {desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default HelpMenu
