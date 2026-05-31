import { WebContentsView } from 'electron'

// Where a fresh browser tile points. Plain google for now; the URL bar
const DEFAULT_URL = 'https://www.google.com'

// Reserved strip at the top of each browser tile. The WebContentsView floats
// ABOVE the renderer's React page, so the URL bar can't sit under it — we
// leave this many pixels empty at the top of the tile and position the native
// view below it. Piece 2 fills this strip with the actual URL bar chrome.
const CHROME_HEIGHT = 36

// Inset that matches TileGrid's per-tile padding (10px) plus its 1px border,
// so the native view lines up inside the tile's visible card instead of
// overlapping the rounded border.
const INSET = 11

// BrowserManager is the main-process owner of every browser tile's native
// WebContentsView — the browser counterpart to PtyManager. React never holds
// the web content; it only draws chrome. This class creates the views,
// positions them at the tile bounds the renderer computed, hides views in
// inactive workspaces, and destroys views when their tile is closed.
class BrowserManager {
  constructor() {
    this.views = new Map() // tileId -> WebContentsView
    this.parent = null // the BrowserWindow whose contentView we attach to
  }

  // Call once the BrowserWindow exists so we have something to parent views to.
  attach(window) {
    this.parent = window
  }

  // Lazily create a view for a browser tile and start loading the default URL.
  // Idempotent so applyLayout() can call it unconditionally.
  _create(id) {
    if (this.views.has(id)) return

    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    // addChildView stacks the view ABOVE the window's main page (React), which
    // is exactly what we want — the live site floats over the placeholder div.
    this.parent.contentView.addChildView(view)
    view.webContents.loadURL(DEFAULT_URL)

    // Keep target=_blank / window.open navigations inside the tile instead of
    // spawning detached popups over our frameless always-on-top window.
    view.webContents.setWindowOpenHandler(({ url }) => {
      view.webContents.loadURL(url)
      return { action: 'deny' }
    })

    this.views.set(id, view)
  }

  _destroy(id) {
    const view = this.views.get(id)
    if (!view) return
    this.parent.contentView.removeChildView(view)
    // Tear down the underlying web contents so the page/process is released.
    view.webContents.close()
    this.views.delete(id)
  }

  // Reconcile the native views against the latest layout snapshot. Called after
  // every layout change (spawn, close, focus, resize, workspace switch). This
  // is the single source of truth for what exists and where it sits.
  applyLayout(layout) {
    if (!this.parent) return

    const { activeWorkspace, workspaces } = layout

    // Every browser tile id that still exists anywhere, so we can drop views
    // whose tile was closed.
    const liveIds = new Set()
    for (const ws of Object.values(workspaces)) {
      for (const tile of ws.tiles) {
        if (tile.type === 'browser') liveIds.add(tile.id)
      }
    }
    for (const id of [...this.views.keys()]) {
      if (!liveIds.has(id)) this._destroy(id)
    }

    // Position + show the active workspace's browser tiles; hide the rest.
    for (const [wsId, ws] of Object.entries(workspaces)) {
      const isActive = Number(wsId) === Number(activeWorkspace)
      for (const tile of ws.tiles) {
        if (tile.type !== 'browser') continue
        this._create(tile.id)
        const view = this.views.get(tile.id)

        if (!isActive || !tile.bounds) {
          view.setVisible(false)
          continue
        }

        const b = tile.bounds
        view.setVisible(true)
        view.setBounds({
          x: b.x + INSET,
          y: b.y + INSET + CHROME_HEIGHT,
          width: Math.max(0, b.width - INSET * 2),
          height: Math.max(0, b.height - INSET * 2 - CHROME_HEIGHT)
        })
      }
    }
  }
}

export default BrowserManager
