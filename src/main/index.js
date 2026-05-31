import { app, shell, BrowserWindow, ipcMain, screen, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import PtyManager from './PtyManager'
import TileManager from './TileManager'
import ModeManager from './ModeManager'
import BrowserManager from './BrowserManager'
import SessionManager from './SessionManager'

const ptyManager = new PtyManager()
const tileManager = new TileManager()
const modeManager = new ModeManager()
const browserManager = new BrowserManager()
const sessionManager = new SessionManager()

// Single exit point for layout updates: reconcile the native browser views
// against the new layout, then push it to the renderer. Every IPC handler
// that mutates tiles funnels through here so WebContentsViews never drift out
// of sync with the React-drawn tile grid.
function broadcastLayout(sender) {
  const layout = tileManager.getLayout()
  browserManager.applyLayout(layout)
  sender.send('tile:layout', layout)
  syncBrowserFocus()
}

// Read the active workspace's focused tile from the current layout.
function getActiveFocus() {
  const layout = tileManager.getLayout()
  const ws = layout.workspaces[layout.activeWorkspace]
  const focusedId = ws?.focusedId ?? null
  const focusedType = ws?.tiles.find((t) => t.id === focusedId)?.type ?? null
  return { focusedId, focusedType }
}

// Single place that decides who owns the keyboard: the React page (TILE mode,
// or terminal tiles) or a native browser view (INSERT mode on a browser tile).
// Called after every layout change and every mode toggle.
function syncBrowserFocus() {
  const { focusedId, focusedType } = getActiveFocus()
  browserManager.focusActiveView({ mode: modeManager.currentMode, focusedId, focusedType })
}

// Seed the initial state. If a previous session was saved, rehydrate its mode
// and tiles; otherwise start with one terminal tile so there's something to
// show. Must run after the app is ready (SessionManager reads userData), so
// it's called from whenReady — not at import time. Either way, no pty is
// spawned here: each restored TerminalTile signals pty:ready on mount and main
// spawns its shell then.
function initializeSession() {
  const saved = sessionManager.load()
  if (saved) {
    modeManager.setMode(saved.mode)
    tileManager.restore(saved)
  } else {
    tileManager.addTile('terminal')
  }
}

let mainWindow = null

function createWindow() {
  // Cover the full screen without entering macOS native fullscreen Space.
  const { width, height } = screen.getPrimaryDisplay().bounds

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    roundedCorners: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Appear on every macOS Space so it overlays wherever the user is.
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Give BrowserManager the window so it can parent native WebContentsViews.
  browserManager.attach(mainWindow)

  // A mode flip (from anywhere) re-decides who holds the keyboard.
  modeManager.onChange = () => syncBrowserFocus()

  // Shift+Enter while a browser view had focus: React never saw it, so toggle
  // the mode here. The onChange hook above then re-syncs focus.
  browserManager.onShiftEnter = () => modeManager.toggle()

  // The native view grabbed OS focus (it auto-focuses after load, or the user
  // clicked the page). In TILE mode that would silently break our keyboard
  // shortcuts, so bounce focus back to React. We deliberately do NOT enter
  // INSERT here — otherwise a tile would jump into INSERT the moment it spawns.
  // In INSERT mode the click is a deliberate switch to this tile, so update
  // TileManager's focusedId and rebroadcast so the React glow border tracks it;
  // without this, Q and WASD would still act on the previously focused tile.
  browserManager.onViewFocus = (id) => {
    if (modeManager.currentMode === 'TILE') {
      browserManager.focusParent()
    } else {
      tileManager.setFocus(id)
      broadcastLayout(mainWindow.webContents)
    }
  }

  // A real click inside a browser tile's live page. Focus that tile and, if
  // we're in TILE mode, drop into INSERT — mirroring a click on a terminal
  // tile. Unlike onViewFocus this only fires on an actual mouseDown, so a
  // freshly spawned tile's auto-focus never trips it. The mode toggle's
  // onChange hook re-syncs native focus back onto the clicked page.
  browserManager.onViewClick = (id) => {
    tileManager.setFocus(id)
    if (modeManager.currentMode === 'TILE') modeManager.toggle()
    broadcastLayout(mainWindow.webContents)
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // Note: we do NOT spawn the initial shell here. ready-to-show only means
    // the page has done its first paint — React hasn't mounted yet, so the
    // pty:data listener inside TerminalTile is not registered. Spawning now
    // means zsh's startup banner and first prompt go to a webContents with
    // no listener and are silently dropped. Instead, the renderer signals
    // readiness via the pty:ready channel below.
    modeManager.attach(mainWindow.webContents)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Rehydrate (or seed) tile + mode state before the window loads, so the very
  // first layout the renderer receives already reflects the restored session.
  initializeSession()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Tile IPC listeners
  ipcMain.on('tile:resize', (event, { width, height }) => {
    tileManager.setWindowSize(width, height)
    broadcastLayout(event.sender)
  })

  ipcMain.on('tile:spawn', (event, type) => {
    const id = tileManager.addTile(type)
    if (id === null) return
    // Don't spawn the pty here — TerminalTile will call pty:ready once its
    // pty:data listener is wired, and main spawns then. Spawning eagerly here
    // races the renderer mount and drops the shell's startup output. Browser
    // tiles need no such handshake: broadcastLayout creates their view.
    broadcastLayout(event.sender)
  })

  ipcMain.on('tile:close', (event, id) => {
    const tile = tileManager.getTile(id)
    tileManager.removeTile(id)
    if (tile?.type === 'terminal') ptyManager.kill(id)
    // A closed browser tile no longer appears in the layout, so broadcastLayout
    // → applyLayout will tear down its WebContentsView.
    broadcastLayout(event.sender)
  })

  ipcMain.on('tile:focus', (event, id) => {
    tileManager.setFocus(id)
    broadcastLayout(event.sender)
  })

  ipcMain.on('tile:focus-direction', (event, dir) => {
    tileManager.focusDirection(dir)
    broadcastLayout(event.sender)
  })

  ipcMain.on('workspace:switch', (event, id) => {
    tileManager.switchWorkspace(id)
    broadcastLayout(event.sender)
  })

  // Browser navigation IPC — routed straight to the native WebContentsView
  // that BrowserManager owns for the given tile id.
  ipcMain.on('browser:navigate', (_event, { id, url }) => browserManager.navigate(id, url))
  ipcMain.on('browser:back', (_event, id) => browserManager.back(id))
  ipcMain.on('browser:forward', (_event, id) => browserManager.forward(id))
  ipcMain.on('browser:reload', (_event, id) => browserManager.reload(id))
  // BrowserTile asks for current state on mount so its URL bar is correct even
  // if it mounted after the page's first navigation already fired.
  ipcMain.on('browser:request-state', (_event, id) => browserManager.emitState(id))
  // Renderer tells us when the URL bar is focused so we don't steal focus to
  // the native page while the user is typing a URL.
  ipcMain.on('browser:set-editing', (_event, { id, editing }) =>
    browserManager.setEditing(id, editing)
  )

  // Renderer-driven shell spawn. TerminalTile sends this from inside its
  // useEffect, immediately after registering the pty:data listener. By
  // waiting for this signal we guarantee the listener exists before zsh
  // prints its banner + first prompt, which fixes the dropped-output race
  // at startup and on every new T-spawned tile.
  ipcMain.on('pty:ready', (event, id) => {
    const tile = tileManager.getTile(id)
    if (tile?.type !== 'terminal') return

    ptyManager.spawn(id, event.sender, () => {
      // Shell exited (user typed `exit`, Ctrl-D, crash, or our own kill()
      // call when Q is pressed). Collapse the tile so its xterm unmounts and
      // the remaining tiles redistribute. isDestroyed guard handles the case
      // where the shell exits as part of app shutdown — webContents is gone,
      // so a send() would throw. Calling removeTile twice (once here, once
      // from tile:close on Q) is safe; it's a filter, not a pop.
      if (event.sender.isDestroyed()) return
      tileManager.removeTile(id)
      broadcastLayout(event.sender)
    })
  })

  createWindow()

  // Global hotkey 
  globalShortcut.register('Option+Space', () => {
    if (mainWindow.isVisible()) {
      // app.hide() tells macOS to return focus to the previously active app.
      mainWindow.hide()
      app.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
      syncBrowserFocus()
    }
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Shape the live state into the persisted session schema. We drop per-tile
// bounds (they're recomputed from window size on restore) and keep only the
// identity bits — id + type — plus mode and the active workspace. Browser url
// and terminal cwd are layered on in later pieces.
function buildSessionSnapshot() {
  const layout = tileManager.getLayout()
  const workspaces = {}
  for (const [wsId, ws] of Object.entries(layout.workspaces)) {
    workspaces[wsId] = {
      tiles: ws.tiles.map((t) => ({ id: t.id, type: t.type }))
    }
  }
  return {
    mode: modeManager.currentMode,
    activeWorkspace: layout.activeWorkspace,
    workspaces
  }
}

// Persist the session as the app shuts down. before-quit fires ahead of
// window-all-closed (and thus ahead of ptyManager.killAll), so the shells are
// still alive here when we later need to read their cwd.
app.on('before-quit', () => {
  sessionManager.save(buildSessionSnapshot())
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Kill all shell processes so they don't linger after the app closes.
  ptyManager.killAll()
  globalShortcut.unregisterAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
