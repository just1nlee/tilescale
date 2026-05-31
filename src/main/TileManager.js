import { randomUUID } from 'crypto'

class TileManager {
  constructor() {
    this.activeWorkspace = 1
    this.workspaces = {}
    for (let i = 1; i <= 5; i++) {
      this.workspaces[i] = { tiles: [], focusedId: null }
    }
    this.windowWidth = 900
    this.windowHeight = 670
  }

  // Shorthand for the active workspace slot.
  _ws() {
    return this.workspaces[this.activeWorkspace]
  }

  // Called when the renderer reports the real window pixel size.
  setWindowSize(width, height) {
    this.windowWidth = width
    this.windowHeight = height
    this._recalculate()
  }

  // Switches to workspace id, freezing the current one in place.
  switchWorkspace(id) {
    this.activeWorkspace = id
    this._recalculate()
  }

  // Rebuild the workspace map from a persisted session snapshot. We trust only
  // the identity fields (id + type), re-derive bounds via _recalculate, and
  // defensively clamp to the same rules new tiles obey: known types only, max
  // 2 per workspace. focusedId isn't persisted, so we focus the last restored
  // tile in each workspace (matching how spawning leaves focus). Bad/missing
  // data falls back to sane defaults rather than throwing.
  restore(snapshot) {
    for (let i = 1; i <= 5; i++) {
      this.workspaces[i] = { tiles: [], focusedId: null }
    }

    const saved = snapshot?.workspaces ?? {}
    for (let i = 1; i <= 5; i++) {
      const tiles = (saved[i]?.tiles ?? [])
        .filter((t) => t && (t.type === 'terminal' || t.type === 'browser') && t.id)
        .slice(0, 2)
        .map((t) => ({ id: t.id, type: t.type, url: t.url, bounds: null }))
      this.workspaces[i] = {
        tiles,
        focusedId: tiles.length ? tiles[tiles.length - 1].id : null
      }
    }

    const ws = snapshot?.activeWorkspace
    this.activeWorkspace = ws >= 1 && ws <= 5 ? ws : 1
    this._recalculate()
  }

  // Adds a tile of the given type, focuses it, returns its id. Max 2 tiles.
  addTile(type) {
    if (this._ws().tiles.length >= 2) return null
    const id = randomUUID()
    this._ws().tiles.push({ id, type, bounds: null })
    this._ws().focusedId = id
    this._recalculate()
    return id
  }

  // Removes a tile by id and shifts focus to the last remaining tile. Searches
  // ALL workspaces, not just the active one: the Q-key close path only ever
  // targets the focused (active-workspace) tile, but a terminal's shell can
  // exit in an inactive workspace — its pty:ready/onExit fires while hidden —
  // and that dead tile must be collapsed from its own workspace, not whichever
  // one happens to be active. Falls back gracefully if the id isn't found.
  removeTile(id) {
    const ws = this._findWorkspace(id)
    if (!ws) return
    ws.tiles = ws.tiles.filter((t) => t.id !== id)
    if (ws.focusedId === id) {
      ws.focusedId = ws.tiles.length > 0 ? ws.tiles[ws.tiles.length - 1].id : null
    }
    this._recalculate()
  }

  // The workspace slot whose tiles currently hold id, or null if none do.
  _findWorkspace(id) {
    for (let i = 1; i <= 5; i++) {
      if (this.workspaces[i].tiles.some((t) => t.id === id)) return this.workspaces[i]
    }
    return null
  }

  getTile(id) {
    return this._ws().tiles.find((t) => t.id === id)
  }

  // Find a tile by id across ALL workspaces, not just the active one. pty:ready
  // can fire for a terminal in an inactive workspace — restore mounts every
  // workspace's tiles at once — where getTile's active-only search would miss
  // it and the shell would never spawn, leaving the restored tile permanently
  // blank. Used by the pty:ready handler so background-workspace terminals come
  // back to life on restore.
  findTile(id) {
    for (let i = 1; i <= 5; i++) {
      const tile = this.workspaces[i].tiles.find((t) => t.id === id)
      if (tile) return tile
    }
    return null
  }

  setFocus(id) {
    this._ws().focusedId = id
  }

  focusDirection(dir) {
    const focused = this.getTile(this._ws().focusedId)
    if (!focused) return

    const fc = { x: focused.bounds.x + focused.bounds.width / 2 }

    const candidates = this._ws().tiles.filter((t) => {
      if (t.id === this._ws().focusedId) return false
      const cx = t.bounds.x + t.bounds.width / 2
      if (dir === 'a') return cx < fc.x
      if (dir === 'd') return cx > fc.x
    })

    if (candidates.length === 0) return

    const nearest = candidates.reduce((best, t) => {
      const dist = Math.abs(t.bounds.x + t.bounds.width / 2 - fc.x)
      const bestDist = Math.abs(best.bounds.x + best.bounds.width / 2 - fc.x)
      return dist < bestDist ? t : best
    })

    this._ws().focusedId = nearest.id
  }

  // Returns the layout snapshot the renderer needs to draw tiles.
  // Includes every workspace so the renderer can keep all tiles mounted
  // (hidden workspaces just toggle display:none), preserving xterm scrollback
  // and live pty:data subscriptions across workspace switches.
  getLayout() {
    const workspaces = {}
    for (const [id, ws] of Object.entries(this.workspaces)) {
      workspaces[id] = {
        tiles: ws.tiles.map((t) => ({ id: t.id, type: t.type, url: t.url, bounds: t.bounds })),
        focusedId: ws.focusedId
      }
    }
    return {
      activeWorkspace: this.activeWorkspace,
      workspaces
    }
  }

  // Fractional layouts per tile count. Each entry is [{ x, y, w, h }] in 0–1 space.
  static LAYOUTS = [
    null,
    [{ x: 0, y: 0, w: 1, h: 1 }],
    [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 }
    ],
    [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 }
    ],
    [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }
    ]
  ]

  // Recompute bounds for EVERY workspace, not just the active one. The layout
  // math depends only on window size and tile count — both workspace-agnostic —
  // so there's no reason inactive workspaces should sit with null bounds. Doing
  // them all means a restored session's tiles in workspaces 2–5 get bounds
  // immediately, so TileGrid mounts them (hidden via display:none) and their
  // terminals spawn their ptys right away instead of lazily on first visit.
  // This keeps inactive-workspace shells running in the background as the spec
  // promises, and matches how browser views are already created eagerly.
  _recalculate() {
    for (let i = 1; i <= 5; i++) {
      this._layoutWorkspace(this.workspaces[i].tiles)
    }
  }

  // Assign equal-split bounds to one workspace's tile array in place.
  _layoutWorkspace(tiles) {
    const count = tiles.length
    if (count === 0) return

    const slots = TileManager.LAYOUTS[count]
    const W = this.windowWidth
    const H = this.windowHeight
    // Matches StatusBar's 8px margin. Outer edges inset by GAP, shared
    // edges inset by GAP/2 from each side so the visible channel is also GAP.
    const GAP = 8
    const HALF = GAP / 2

    tiles.forEach((tile, i) => {
      const s = slots[i]
      const left = s.x === 0 ? GAP : HALF
      const top = s.y === 0 ? GAP : HALF
      const right = s.x + s.w >= 1 ? GAP : HALF
      const bottom = s.y + s.h >= 1 ? GAP : HALF

      tile.bounds = {
        x: Math.round(s.x * W + left),
        y: Math.round(s.y * H + top),
        width: Math.round(s.w * W - left - right),
        height: Math.round(s.h * H - top - bottom)
      }
    })
  }
}

export default TileManager
