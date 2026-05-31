import { app, shell, BrowserWindow, ipcMain, screen, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import PtyManager from './PtyManager'
import TileManager from './TileManager'
import ModeManager from './ModeManager'

const ptyManager = new PtyManager()
const tileManager = new TileManager()
const modeManager = new ModeManager()

// Start with one terminal tile so there's something to display on launch.
// Its pty is not spawned here — TerminalTile signals pty:ready once its
// pty:data listener is wired, and main spawns the shell then.
tileManager.addTile('terminal')

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

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Tile IPC listeners
  ipcMain.on('tile:resize', (event, { width, height }) => {
    tileManager.setWindowSize(width, height)
    event.sender.send('tile:layout', tileManager.getLayout())
  })

  ipcMain.on('tile:spawn', (event, type) => {
    const id = tileManager.addTile(type)
    if (id === null) return
    // Don't spawn the pty here — TerminalTile will call pty:ready once its
    // pty:data listener is wired, and main spawns then. Spawning eagerly here
    // races the renderer mount and drops the shell's startup output.
    event.sender.send('tile:layout', tileManager.getLayout())
  })

  ipcMain.on('tile:close', (event, id) => {
    const tile = tileManager.getTile(id)
    tileManager.removeTile(id)
    if (tile?.type === 'terminal') ptyManager.kill(id)
    event.sender.send('tile:layout', tileManager.getLayout())
  })

  ipcMain.on('tile:focus', (event, id) => {
    tileManager.setFocus(id)
    event.sender.send('tile:layout', tileManager.getLayout())
  })

  ipcMain.on('tile:focus-direction', (event, dir) => {
    tileManager.focusDirection(dir)
    event.sender.send('tile:layout', tileManager.getLayout())
  })

  ipcMain.on('workspace:switch', (event, id) => {
    tileManager.switchWorkspace(id)
    event.sender.send('tile:layout', tileManager.getLayout())
  })

  // Renderer-driven shell spawn. TerminalTile sends this from inside its
  // useEffect, immediately after registering the pty:data listener. By
  // waiting for this signal we guarantee the listener exists before zsh
  // prints its banner + first prompt, which fixes the dropped-output race
  // at startup and on every new T-spawned tile.
  ipcMain.on('pty:ready', (event, id) => {
    const tile = tileManager.getTile(id)
    if (tile?.type === 'terminal') ptyManager.spawn(id, event.sender)
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
    }
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
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
