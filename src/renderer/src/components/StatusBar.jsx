function StatusBar({ mode, workspace }) {
  const isInsert = mode === 'INSERT'
  const modeStyle = isInsert
    ? { bg: 'rgba(255, 176, 64, 0.18)', text: '#ffcf80', border: 'rgba(255, 176, 64, 0.45)' }
    : { bg: 'rgba(94, 158, 255, 0.18)', text: '#9ec5ff', border: 'rgba(94, 158, 255, 0.45)' }
  const modeLabel = isInsert ? 'Insert' : 'Tile'

  return (
    <div style={{
      flexShrink: 0,
      background: 'rgba(255, 255, 255, 0.08)',
      border: '1px solid rgba(255, 255, 255, 0.18)',
      borderRadius: '10px',
      margin: '8px',
      padding: '8px',
      boxSizing: 'border-box',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
    }}>
      <div style={{
        height: '32px',
        background: 'rgba(20, 20, 20, 0.55)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '6px',
        color: '#f0f0f0',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '0 12px',
        fontSize: '13px',
        fontFamily: 'monospace',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
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
        <span style={{
          color: 'rgba(255, 255, 255, 0.55)',
          fontSize: '12px',
        }}>
          workspace {workspace}
        </span>
      </div>
    </div>
  )
}

export default StatusBar
