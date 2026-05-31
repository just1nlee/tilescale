import { useState, useEffect } from 'react'
import TileGrid from './components/TileGrid'
import StatusBar from './components/StatusBar'

function App() {
  const [mode, setMode] = useState('TILE')
  const [layout, setLayout] = useState({ activeWorkspace: 1, workspaces: {} })
  // Profile state is now owned by main; we mirror its profile:state pushes
  // into React. The Default seed is just a placeholder for the tick between
  // first mount and main's initial push, so the StatusBar selector renders
  // something rather than collapsing. After that, every update comes from
  // ProfileManager via window.profile.onState.
  const [profiles, setProfiles] = useState([{ id: 'default', name: 'Default' }])
  const [activeProfileId, setActiveProfileId] = useState('default')

  useEffect(() => {
    const unsubMode = window.mode.onChange((m) => setMode(m))
    const unsubLayout = window.tile.onLayout((l) => setLayout(l))
    const unsubProfile = window.profile.onState((state) => {
      setProfiles(state.profiles)
      setActiveProfileId(state.activeId)
    })
    return () => {
      unsubMode()
      unsubLayout()
      unsubProfile()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        window.mode.toggle()
        return
      }

      // Handle macOS quit shortcut
      if (e.metaKey && e.key === 'q') return

      if (mode !== 'TILE') return

      e.preventDefault()
      e.stopPropagation()

      const focusedId = layout.workspaces?.[layout.activeWorkspace]?.focusedId

      switch (e.key.toLowerCase()) {
        case 'b': window.tile.spawn('browser'); break
        case 't': window.tile.spawn('terminal'); break
        case 'q': if (focusedId) window.tile.close(focusedId); break
        case 'a': case 'h': case 'arrowleft': window.tile.focusDirection('a'); break
        case 'd': case 'l': case 'arrowright': window.tile.focusDirection('d'); break
        case '1': case '2': case '3': case '4': case '5':
          window.workspace.switch(parseInt(e.key)); break
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [mode, layout])

  const handleTileClick = (id) => {
    window.tile.focus(id)
    if (mode === 'TILE') window.mode.toggle()
  }

  // Both delegate to main and never mutate local state directly — the
  // profile:state push that follows the switch/create updates React. Matches
  // how window.mode.toggle() drives mode changes through main.
  const handleSelectProfile = (id) => {
    window.profile.switch(id)
  }

  const handleCreateProfile = (name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    window.profile.create(trimmed)
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <TileGrid layout={layout} onTileClick={handleTileClick} />
      </div>
      <StatusBar
        mode={mode}
        workspace={layout.activeWorkspace ?? 1}
        profiles={profiles}
        activeProfileId={activeProfileId}
        onSelectProfile={handleSelectProfile}
        onCreateProfile={handleCreateProfile}
      />
    </div>
  )
}

export default App
