# CLAUDE.md — Tilescale

Tilescale is a macOS-only Electron app that acts as a keyboard-driven tiling window manager. It runs as a background app and is summoned via a global hotkey. Tiles are either **browser** (`WebContentsView` with URL bar + back/forward/reload) or **terminal** (xterm.js + node-pty). Layout is automatic equal-split — no dragging.

## How to Work With Me
You are a coding tutor, not just a code generator. Follow these rules on every step:

1. Before writing any code, explain what the piece does, why it exists,
   and how it connects to what we've already built.
2. Write only one piece at a time. Stop and wait for "next" or questions.
3. Never skip ahead or combine steps.
4. If I ask why something works, explain it before continuing.
5. After each step, summarize what we built and how it fits the architecture.

## Stack
- **Scaffold**: `electron-vite` | **Language**: JavaScript | **Renderer**: Vite + React
- **Terminal**: xterm.js (renderer) + node-pty (main) | **Browser tiles**: `WebContentsView`
- **Persistence**: `electron-store` → `userData/session.json`

## Keybindings

### Global (works even when Tilepad is hidden)
| Key | Action |
|---|---|
| `Option+Space` | Toggle Tilepad visibility. Restores previous mode (INSERT or TILE). |

### App-level (any time Tilepad is visible)
| Key | Action |
|---|---|
| `Shift+Space` | Toggle INSERT ↔ TILE mode. Mode persists across hide/show cycles. |

### TILE Mode
| Key | Action |
|---|---|
| `W A S D` | Focus tile above / left / below / right |
| `B` | Spawn new browser tile |
| `T` | Spawn new terminal tile |
| `Q` | Close focused tile |

### INSERT Mode
All keystrokes pass directly to the focused tile. `Shift+Enter` returns to TILE mode.

## Layout — Auto-Split
Tiles divide screen space equally at all times. No dragging, no manual resize.
- Spawn tile → all tiles recalculate to equal-width columns
- Close tile → remaining tiles redistribute equally
- Focused tile has a glowing border. Unfocused tiles have a normal border.
- `StatusBar` always visible showing current mode: `-- TILE --` or `-- INSERT --`

## Architecture
```
Main Process (Node.js)
├── WindowManager   — fullscreen always-on-top BrowserWindow, show/hide on Option+Space
├── TileManager     — tile array, auto-split bounds calculation, focus tracking
├── PtyManager      — node-pty spawn/kill/IO per terminal tile
├── SessionManager  — save/restore session JSON and current mode
├── ModeManager     — INSERT vs TILE state, Shift+Space handler, globalShortcut
└── ipc/            — all renderer↔main communication (pattern: domain:action)

Renderer Process (React + Vite)
├── App             — root, owns mode + tile state from main via IPC
├── TileGrid        — renders tiles at calculated bounds, focused tile glow
├── BrowserTile     — URL bar, back/forward/reload over WebContentsView
├── TerminalTile    — xterm.js instance, PTY data over IPC
└── StatusBar       — current mode display
```

**WebContentsView rule**: bounds are set in main process only. Renderer sends `tile:resize` via IPC; main applies it. React draws a placeholder div at the same position; the real WebContentsView floats on top.

**node-pty rule**: run `electron-rebuild` in postinstall. Skipping this silently breaks all terminal tiles.

**xterm.js rule**: call `terminal.open(el)` only after the container has non-zero pixel dimensions.

**Context isolation**: use `contextBridge` in preload to expose IPC. Never set `nodeIntegration: true`.

## Session Schema
```json
{ "version": 1, "mode": "TILE", "tiles": [
  { "id": "uuid", "type": "browser", "url": "https://..." },
  { "id": "uuid", "type": "terminal", "cwd": "/home/user" }
]}
```
Save on `app.before-quit`. Restore on launch. Tiles re-split equally on restore. Graceful fallback if file missing.

## Build Order (24h)
1. `electron-vite` scaffold → single WebContentsView → single terminal tile working
2. `TileManager` auto-split math → `TileGrid` renders equal columns → `tile:resize` IPC
3. `ModeManager` → `Option+Space` global toggle → `Shift+Space` mode switch → `StatusBar`
4. WASD focus navigation → `B`/`T` spawn → `Q` close
5. Browser tile URL bar + back/forward/reload
6. `SessionManager` save/restore including mode
7. Focused tile glow → demo polish → keybinding cheatsheet in README