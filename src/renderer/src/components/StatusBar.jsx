function StatusBar({ mode, workspace }) {
  const label = mode === 'INSERT' ? '-- INSERT --' : `-- TILE -- [${workspace}]`

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
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '12px',
        fontSize: '13px',
        fontFamily: 'monospace',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
        {label}
      </div>
    </div>
  )
}

export default StatusBar
