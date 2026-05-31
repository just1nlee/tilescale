function StatusBar({ mode, workspace }) {
  const isInsert = mode === 'INSERT'
  const modeStyle = isInsert
    ? { bg: 'rgba(255, 176, 64, 0.18)', text: '#ffcf80', border: 'rgba(255, 176, 64, 0.45)' }
    : { bg: 'rgba(94, 158, 255, 0.18)', text: '#9ec5ff', border: 'rgba(94, 158, 255, 0.45)' }
  const modeLabel = isInsert ? 'Insert' : 'Tile'

  return (
    <div style={{
      flexShrink: 0,
      height: '36px',
      background: 'rgba(20, 20, 20, 0.55)',
      border: '1px solid rgba(255, 255, 255, 0.18)',
      borderRadius: '10px',
      margin: '0 8px 8px 8px',
      padding: '0 12px',
      boxSizing: 'border-box',
      color: '#f0f0f0',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '13px',
      fontFamily: 'monospace',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
    }}>
      <span style={{
        background: modeStyle.bg,
        color: modeStyle.text,
        border: `1px solid ${modeStyle.border}`,
        borderRadius: '5px',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.6px',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}>
        {modeLabel}
      </span>
      <div style={{
        marginLeft: 'auto',
        display: 'flex',
        gap: '2px',
        height: '100%',
        alignItems: 'stretch',
      }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n === workspace
          return (
            <div
              key={n}
              style={{
                minWidth: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderTop: `2px solid ${active ? modeStyle.text : 'transparent'}`,
                background: active ? 'rgba(255, 255, 255, 0.07)' : 'transparent',
                color: active ? '#f0f0f0' : 'rgba(255, 255, 255, 0.4)',
                fontSize: '12px',
                fontWeight: active ? 600 : 500,
                transition: 'color 120ms ease, background 120ms ease',
              }}
            >
              {n}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default StatusBar
