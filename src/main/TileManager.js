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

  // Removes a tile by id and shifts focus to the last remaining tile.
  removeTile(id) {
    this._ws().tiles = this._ws().tiles.filter((t) => t.id !== id)
    if (this._ws().focusedId === id) {
      const tiles = this._ws().tiles
      this._ws().focusedId = tiles.length > 0 ? tiles[tiles.length - 1].id : null
    }
    this._recalculate()
  }

  getTile(id) {
    return this._ws().tiles.find((t) => t.id === id)
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
