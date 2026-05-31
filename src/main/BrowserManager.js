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

// Turn whatever the user typed in the URL bar into a loadable URL: keep
// explicit schemes as-is, treat bare "domain.tld" as https, and fall back to
// a Google search for anything else (e.g. multi-word queries).
function normalizeUrl(input) {
  const s = (input ?? '').trim()
  if (!s) return null
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s
  if (/^[^\s]+\.[^\s]+$/.test(s)) return `https://${s}`
  return `https://www.google.com/search?q=${encodeURIComponent(s)}`
}

// BrowserManager is the main-process owner of every browser tile's native
// WebContentsView — the browser counterpart to PtyManager. React never holds
// the web content; it only draws chrome. This class creates the views,
// positions them at the tile bounds the renderer computed, hides views in
// inactive workspaces, and destroys views when their tile is closed.
class BrowserManager {
  constructor() {
    this.views = new Map() // tileId -> WebContentsView
    this.parent = null // the BrowserWindow whose contentView we attach to
    // Hooks wired up by main:
    //   onShiftEnter()   — Shift+Enter pressed while a browser view had focus
    //   onViewFocus(id)  — the native view gained OS focus (click OR auto-focus)
    //   onViewClick(id)  — a real pointer press landed inside the live page
    this.onShiftEnter = null
    this.onViewFocus = null
    this.onViewClick = null
    // Tile id whose React URL bar currently holds focus. While set, we must not
    // steal OS focus to that tile's native page or the user can't type a URL.
    this.editingId = null
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

    // Whenever the page navigates or its load state flips, push fresh state to
    // the URL bar so it tracks the real page (typed nav, link clicks, redirects,
    // back/forward all funnel through these events).
    const emit = () => this.emitState(id)
    view.webContents.on('did-navigate', emit)
    view.webContents.on('did-navigate-in-page', emit)
    view.webContents.on('did-start-loading', emit)
    view.webContents.on('did-stop-loading', emit)

    // While this view holds OS focus the React page can't see keydowns, so
    // Shift+Enter (toggle INSERT↔TILE) would be swallowed by the page. Catch it
    // here at the main level and hand it to ModeManager. Everything else passes
    // through to the page, honoring "INSERT passes all keystrokes to the tile".
    view.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.shift && input.key === 'Enter') {
        event.preventDefault()
        this.onShiftEnter?.()
      }
    })

    // Clicking the live page focuses the native view, not React's onClick (the
    // view floats above the placeholder). Tell main so it can mark this tile
    // focused and drop into INSERT — mirroring a terminal-tile click.
    view.webContents.on('focus', () => this.onViewFocus?.(id))

    // A genuine pointer press inside the page. Unlike the 'focus' event above
    // — which also fires when a freshly spawned view auto-focuses after load —
    // a mouseDown only happens when the user actually clicks. That lets main
    // switch into INSERT on a real click without a newly spawned tile jumping
    // into INSERT on its own.
    view.webContents.on('input-event', (_event, input) => {
      if (input.type === 'mouseDown') this.onViewClick?.(id)
    })

    this.views.set(id, view)
  }

  // Push one tile's navigation state to the renderer's URL bar. Sent to the
  // window's main page (React), not the native view itself.
  emitState(id) {
    const view = this.views.get(id)
    if (!view || !this.parent) return
    const wc = view.webContents
    this.parent.webContents.send('browser:state', {
      id,
      url: wc.getURL(),
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
      loading: wc.isLoading()
    })
  }

  navigate(id, input) {
    const view = this.views.get(id)
    const url = normalizeUrl(input)
    if (view && url) view.webContents.loadURL(url)
  }

  back(id) {
    this.views.get(id)?.webContents.navigationHistory.goBack()
  }

  forward(id) {
    this.views.get(id)?.webContents.navigationHistory.goForward()
  }

  reload(id) {
    this.views.get(id)?.webContents.reload()
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

  // The renderer reports when a tile's URL bar gains/loses focus so we know not
  // to fight it for OS focus.
  setEditing(id, editing) {
    if (editing) this.editingId = id
    else if (this.editingId === id) this.editingId = null
  }

  // Hand OS keyboard focus back to the window's React page.
  focusParent() {
    if (this.parent && !this.parent.webContents.isFocused()) this.parent.webContents.focus()
  }

  // Enforce the focus model: the native browser view gets OS keyboard focus
  // ONLY when we're in INSERT mode on a focused browser tile AND its URL bar
  // isn't being edited. In every other case focus belongs to the React page,
  // so the URL bar stays typable and our TILE-mode shortcuts (WASD/B/T/Q/1–5)
  // and Shift+Enter keep working. isFocused() guards keep it idempotent.
  focusActiveView({ mode, focusedId, focusedType }) {
    if (!this.parent) return

    if (mode === 'INSERT' && focusedType === 'browser') {
      // URL bar holds focus — leave it so the user can type a URL.
      if (this.editingId === focusedId) return
      const view = this.views.get(focusedId)
      if (view && !view.webContents.isFocused()) view.webContents.focus()
      return
    }

    // React owns the keyboard now. We must NOT clear editingId here: clicking
    // the URL bar fires its onFocus (setEditing → editingId) and then bubbles
    // to a tile click that focuses the tile while still in TILE mode, running
    // this sync once before the mode flips to INSERT. Wiping editingId at that
    // moment would make the subsequent INSERT sync steal focus to the native
    // page instead of leaving it on the URL bar. The bar's onBlur clears the
    // flag instead.
    this.focusParent()
  }
}

export default BrowserManager
