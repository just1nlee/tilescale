import { randomUUID } from 'crypto'

class TileManager {
  constructor() {
    this.tiles = []       // [{ id, type, bounds: { x, y, width, height } }]
    this.focusedId = null
    this.windowWidth = 900
    this.windowHeight = 670
  }

  // Called when the renderer reports the real window pixel size.
  setWindowSize(width, height) {
    this.windowWidth = width
    this.windowHeight = height
    this._recalculate()
  }

  // Adds a tile of the given type, focuses it, returns its id. Max 4 tiles.
  addTile(type) {
    if (this.tiles.length >= 4) return null
    const id = randomUUID()
    this.tiles.push({ id, type, bounds: null })
    this.focusedId = id
    this._recalculate()
    return id
  }

  // Removes a tile by id and shifts focus to the last remaining tile.
  removeTile(id) {
    this.tiles = this.tiles.filter((t) => t.id !== id)
    if (this.focusedId === id) {
      this.focusedId = this.tiles.length > 0 ? this.tiles[this.tiles.length - 1].id : null
    }
    this._recalculate()
  }

  getTile(id) {
    return this.tiles.find((t) => t.id === id)
  }

  setFocus(id) {
    this.focusedId = id
  }

  // Returns the layout snapshot the renderer needs to draw tiles.
  getLayout() {
    return {
      tiles: this.tiles.map((t) => ({ id: t.id, type: t.type, bounds: t.bounds })),
      focusedId: this.focusedId
    }
  }

  // Fractional layouts per tile count. Each entry is [{ x, y, w, h }] in 0–1 space.
  static LAYOUTS = [
    null,
    [{ x: 0, y: 0, w: 1, h: 1 }],
    [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }],
    [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }],
    [{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }]
  ]

  _recalculate() {
    const count = this.tiles.length
    if (count === 0) return

    const slots = TileManager.LAYOUTS[count]
    const W = this.windowWidth
    const H = this.windowHeight

    this.tiles.forEach((tile, i) => {
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
