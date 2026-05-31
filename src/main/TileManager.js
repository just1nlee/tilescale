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
  getLayout() {
    return {
      tiles: this._ws().tiles.map((t) => ({ id: t.id, type: t.type, bounds: t.bounds })),
      focusedId: this._ws().focusedId,
      activeWorkspace: this.activeWorkspace
    }
  }

  // Fractional layouts per tile count. Each entry is [{ x, y, w, h }] in 0–1 space.
  static LAYOUTS = [
    null,
    [{ x: 0, y: 0, w: 1, h: 1 }],
    [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }],
    [{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 1 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }],
    [{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }]
  ]

  _recalculate() {
    const tiles = this._ws().tiles
    const count = tiles.length
    if (count === 0) return

    const slots = TileManager.LAYOUTS[count]
    const W = this.windowWidth
    const H = this.windowHeight

    tiles.forEach((tile, i) => {
      const s = slots[i]
      tile.bounds = {
        x: Math.round(s.x * W),
        y: Math.round(s.y * H),
        width: Math.round(s.w * W),
        height: Math.round(s.h * H)
      }
    })
  }
}

export default TileManager
