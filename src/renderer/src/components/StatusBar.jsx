function StatusBar({ mode, workspace }) {
  const label = mode === 'INSERT' ? '-- INSERT --' : `-- TILE -- [${workspace}]`

  return (
    <div style={{
      height: '24px',
      background: '#1a1a1a',
      color: '#ccc',
      display: 'flex',
      alignItems: 'center',
      paddingLeft: '12px',
      fontSize: '13px',
      fontFamily: 'monospace',
      flexShrink: 0,
    }}>
      {label}
    </div>
  )
}

export default StatusBar
