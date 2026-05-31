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
  // Profile selector UI state lives here (not in StatusBar) because the keydown
  // handler below — which captures keys at the window level in TILE mode — is
  // what drives P (open/close) and W/S·J/K (move the highlight cursor).
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [highlightedId, setHighlightedId] = useState(null)

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
      // Let the "new profile" name field receive keys normally — without this,
      // TILE-mode preventDefault would swallow every character. Scoped to that
      // one field via its data attribute: the browser URL bar is also an input,
      // but in TILE mode keys there must still run TILE commands, not type a URL.
      if (e.target instanceof HTMLInputElement && e.target.dataset.profileNameInput) return

      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        window.mode.toggle()
        return
      }

      // Handle macOS quit shortcut
      if (e.metaKey && e.key === 'q') return

      if (mode !== 'TILE') return

      const key = e.key.toLowerCase()

      // While the profile selector is open it owns navigation: W/S·J/K (and
      // arrows) move the highlight, Enter commits the switch, P/Escape close.
      // We highlight-then-commit rather than switching on each keypress because
      // a switch tears down ptys and respawns shells — too heavy per keystroke.
      if (selectorOpen) {
        e.preventDefault()
        e.stopPropagation()
        const len = profiles.length
        const idx = Math.max(0, profiles.findIndex((p) => p.id === highlightedId))
        switch (key) {
          case 'p':
          case 'escape':
            setSelectorOpen(false)
            break
          case 'w': case 'k': case 'arrowup':
            setHighlightedId(profiles[(idx - 1 + len) % len].id)
            break
          case 's': case 'j': case 'arrowdown':
            setHighlightedId(profiles[(idx + 1) % len].id)
            break
          case 'enter':
            if (highlightedId) window.profile.switch(highlightedId)
            setSelectorOpen(false)
            break
        }
        return
      }

      // P opens the selector, seeding the highlight on the active profile.
      if (key === 'p') {
        e.preventDefault()
        e.stopPropagation()
        setHighlightedId(activeProfileId)
        setSelectorOpen(true)
        return
      }

      e.preventDefault()
      e.stopPropagation()

      const focusedId = layout.workspaces?.[layout.activeWorkspace]?.focusedId

      switch (key) {
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
  }, [mode, layout, profiles, activeProfileId, selectorOpen, highlightedId])

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
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        highlightedId={highlightedId}
        onHighlightChange={setHighlightedId}
      />
    </div>
  )
}

export default App
