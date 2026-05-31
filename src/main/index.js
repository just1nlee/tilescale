import { app, shell, BrowserWindow, ipcMain, screen, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import PtyManager from './PtyManager'
import TileManager from './TileManager'
import ModeManager from './ModeManager'
import BrowserManager from './BrowserManager'
import SessionManager from './SessionManager'
import ProfileManager from './ProfileManager'

const ptyManager = new PtyManager()
const tileManager = new TileManager()
const modeManager = new ModeManager()
const browserManager = new BrowserManager()
const sessionManager = new SessionManager()
const profileManager = new ProfileManager()

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

// Push the profile list + active id to the renderer so the StatusBar selector
// can render. Sent on initial window show and after every profile change.
function broadcastProfiles(sender) {
  sender.send('profile:state', {
    profiles: profileManager.list(),
    activeId: profileManager.getActiveId()
  })
}

// Freeze the active profile's live tiles into the shape ProfileManager stores
// and TileManager.restore consumes. Used both when switching profiles (to save
// what we're leaving behind) and at quit time (to persist the active profile).
// Browser urls are read live off the WebContentsView, not from the stale
// layout, so the tile reopens on whatever page it currently shows. Terminal
// cwd is not captured — restored shells start at $HOME, same as launch today.
function captureActiveSnapshot() {
  const layout = tileManager.getLayout()
  const workspaces = {}
  for (const [wsId, ws] of Object.entries(layout.workspaces)) {
    workspaces[wsId] = {
      tiles: ws.tiles.map((t) => {
        const tile = { id: t.id, type: t.type }
        if (t.type === 'browser') {
          const url = browserManager.getUrl(t.id)
          if (url) tile.url = url
        }
        return tile
      })
    }
  }
  return { activeWorkspace: layout.activeWorkspace, workspaces }
}

// Swap the entire tile world to a different profile. Mirrors launch-time
// session restore: capture what's leaving, kill its ptys, restore the target's
// snapshot into TileManager, then broadcastLayout — which makes BrowserManager
// destroy outgoing WebContentsViews (they're no longer in any workspace) and
// the renderer remount terminal tiles (each fires pty:ready, main spawns a
// fresh shell). Inactive profiles intentionally hold no live processes; their
// state lives only as snapshots inside ProfileManager.
function switchProfile(sender, targetId) {
  if (!profileManager.has(targetId)) return
  if (targetId === profileManager.getActiveId()) return

  profileManager.setSnapshot(profileManager.getActiveId(), captureActiveSnapshot())
  ptyManager.killAll()

  profileManager.setActive(targetId)
  tileManager.restore(profileManager.getSnapshot(targetId))

  broadcastLayout(sender)
  broadcastProfiles(sender)
}

// Seed the initial state. If a previous session was saved, rehydrate mode +
// profile list, then restore the active profile's tiles into TileManager;
// otherwise start with one terminal tile in the default profile so there's
// something to show. Must run after the app is ready (SessionManager reads
// userData), so it's called from whenReady — not at import time. Either way,
// no pty is spawned here: each restored TerminalTile signals pty:ready on
// mount and main spawns its shell then.
function initializeSession() {
  const saved = sessionManager.load()
  if (saved) {
    // Always boot into TILE mode regardless of the persisted mode, so the
    // keyboard-driven shortcuts (B/T/Q/1–5/P) work the instant the app shows.
    // Restoring a saved INSERT mode silently swallowed every TILE command
    // until the user discovered Shift+Enter. ModeManager already defaults to
    // TILE, so we simply don't override it here.
    profileManager.loadFrom(saved)
    const active = profileManager.getSnapshot(profileManager.getActiveId())
    if (active) tileManager.restore(active)
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
    broadcastProfiles(mainWindow.webContents)
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

  // Strip the "<appName>/x.y.z" and "Electron/x" tokens from the default
  // User-Agent so embedded-browser sign-in checks (Google, Anthropic, GitHub…)
  // see plain Chrome — which, under the hood, the page genuinely is. Setting it
  // on app.userAgentFallback (rather than per WebContentsView) means EVERY
  // webContents we create inherits it, including the OAuth popups that
  // BrowserManager now opens as real child windows. Those popups are fresh
  // webContents that never pass through BrowserManager._create, so a per-view
  // override would miss them and their very first request would be blocked.
  const appToken = new RegExp(` ?${app.getName()}\\/[^\\s]+`, 'i')
  app.userAgentFallback = app.userAgentFallback
    .replace(appToken, '')
    .replace(/ ?Electron\/[^\s]+/i, '')

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

  // Profile IPC — swap the whole tile world to another saved session.
  ipcMain.on('profile:switch', (event, id) => switchProfile(event.sender, id))

  // Add a new profile and jump straight into it (matches the StatusBar
  // dropdown UX, which closes itself after "Add"). create() returns null if
  // we're at the cap, in which case we ignore the request silently.
  ipcMain.on('profile:create', (event, name) => {
    const created = profileManager.create(name)
    if (!created) return
    switchProfile(event.sender, created.id)
  })

  // Rename is pure metadata — no tile changes, just rebroadcast the list.
  ipcMain.on('profile:rename', (event, { id, name }) => {
    profileManager.rename(id, name)
    broadcastProfiles(event.sender)
  })

  // Delete a profile. If it's the active one, the whole tile world must move to
  // the new active profile chosen by ProfileManager.remove: kill the outgoing
  // ptys (no capture — the profile is being discarded) and restore the new
  // active profile's snapshot, exactly like a switch. Deleting an inactive
  // profile only drops its snapshot, so tiles are untouched.
  ipcMain.on('profile:delete', (event, id) => {
    const wasActive = id === profileManager.getActiveId()
    if (!profileManager.remove(id)) return

    if (wasActive) {
      ptyManager.killAll()
      tileManager.restore(profileManager.getSnapshot(profileManager.getActiveId()))
      broadcastLayout(event.sender)
    }
    broadcastProfiles(event.sender)
  })

  // A React overlay (profile selector) opened/closed. Native browser views sit
  // above the React page, so we hide them while it's up. broadcastLayout's
  // applyLayout pass applies the new visibility.
  ipcMain.on('browser:set-overlay', (event, open) => {
    browserManager.setOverlay(open)
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
    // findTile (not getTile) so a restored terminal in an inactive workspace
    // — which mounts and signals readiness while hidden — still gets its shell.
    const tile = tileManager.findTile(id)
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
      // app.hide() above deactivated the whole app, so on macOS
      // mainWindow.focus() alone is a no-op — the window appears but never
      // becomes key, and our keyboard-driven shortcuts stay dead until the
      // user clicks it. app.focus({ steal: true }) reactivates the app and
      // pulls keyboard focus across from whatever app is frontmost.
      app.focus({ steal: true })
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

// Shape the live state into the persisted session form. We freeze the active
// profile's current tiles into ProfileManager first (the other profiles already
// have up-to-date snapshots — they're only ever touched via setSnapshot at
// switch time) and then ask ProfileManager for its disk form, layering mode
// on top as the only true app-global field.
function buildSessionSnapshot() {
  profileManager.setSnapshot(profileManager.getActiveId(), captureActiveSnapshot())
  return {
    mode: modeManager.currentMode,
    ...profileManager.toPersisted()
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
