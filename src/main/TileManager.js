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

  // Adds a tile of the given type, focuses it, returns its id.
  addTile(type) {
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

  // Divides window width into equal columns. Last tile absorbs rounding remainder.
  _recalculate() {
    const count = this.tiles.length
    if (count === 0) return

    const tileWidth = Math.floor(this.windowWidth / count)

    this.tiles.forEach((tile, i) => {
      const isLast = i === count - 1
      tile.bounds = {
        x: i * tileWidth,
        y: 0,
        width: isLast ? this.windowWidth - i * tileWidth : tileWidth,
        height: this.windowHeight
      }
    })
  }
}

export default TileManager
