# CLAUDE.md — Tilescale

Tilescale is a macOS-only Electron app that acts as a keyboard-driven tiling window manager. It runs as a background app and is summoned via a global hotkey. Tiles are either **browser** (`WebContentsView` with URL bar + back/forward/reload) or **terminal** (xterm.js + node-pty). Layout is automatic equal-split — no dragging.

Workspaces (1–5) work exactly like i3: each workspace has its own independent set of tiles. Pressing `1`–`5` in TILE mode switches to that workspace instantly. Switching preserves each workspace's tiles exactly as left.

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
- **Persistence**: Custom `SessionManager` → `userData/session.json` (plain `fs`, no electron-store)

## Keybindings

### Global (works even when Tilepad is hidden)
| Key | Action |
|---|---|
| `Option+Space` | Toggle Tilepad visibility. Restores previous mode (INSERT or TILE). |

### App-level (any time Tilepad is visible)
| Key | Action |
|---|---|
| `Shift+Space` | Toggle INSERT ↔ TILE mode. Works from either mode. Mode persists across hide/show cycles. |

### TILE Mode
| Key | Action |
|---|---|
| `A` / `H` / `←` | Focus tile to the left |
| `D` / `L` / `→` | Focus tile to the right |
| `B` | Spawn new browser tile |
| `T` | Spawn new terminal tile |
| `Q` | Close focused tile |
| `1`–`5` | Switch to workspace 1–5 |
| `P` | Open profile selector |

### Profile Selector (when open)
| Key | Action |
|---|---|
| `W` / `K` / `↑` | Highlight previous profile |
| `S` / `J` / `↓` | Highlight next profile |
| `Enter` | Switch to highlighted profile |
| `P` / `Escape` | Close selector |

### INSERT Mode
All keystrokes pass directly to the focused tile. `Shift+Space` toggles back to TILE mode.

## Layout — Auto-Split
Tiles divide screen space equally at all times. No dragging, no manual resize.
- Spawn tile → all tiles recalculate to equal-width columns
- Close tile → remaining tiles redistribute equally
- Focused tile has a glowing border. Unfocused tiles have a normal border.
- `StatusBar` always visible showing current mode, active workspace, and profile selector button.

## Workspaces
There are 5 workspaces numbered 1–5, mirroring i3 behavior exactly.
- Each workspace holds its own independent tile array and focused tile.
- Pressing `1`–`5` in TILE mode switches the active workspace immediately.
- Switching away preserves the old workspace's tiles in memory; switching back restores them.
- PTY processes for inactive workspaces keep running in the background.
- Workspace 1 is active on launch; all other workspaces start empty.
- `TileManager` owns the workspace map: `{ [workspaceId]: { tiles, focusedId } }`.
- Max **2 tiles per workspace**.

## Profiles
Profiles are named saved sessions, each carrying their own 5-workspace tile layout.
- Multiple profiles can exist (max 9, names capped at 12 characters).
- Switching profiles snapshots the active profile's live tiles, then restores the target profile.
- `ProfileManager` owns: ordered profile list, `activeId`, and frozen `snapshots` per profile.
- The active profile's live tiles always live in `TileManager`; inactive profiles' tile layouts live as frozen snapshots in `ProfileManager`.
- Profile operations: create, rename, delete (can't delete the last profile).
- `P` in TILE mode opens the status-bar profile selector dropdown.
- While the selector is open, all native `WebContentsView` instances are hidden via `browser:set-overlay` (native views composite above React and can't be covered by CSS z-index).

## Architecture
```
Main Process (Node.js)
├── index.js        — app entry, IPC handlers, window creation, Option+Space shortcut
├── TileManager     — workspace map, tile array per workspace, auto-split bounds, focus tracking
├── BrowserManager  — WebContentsView lifecycle, URL navigation, focus model, overlay hiding
├── PtyManager      — node-pty spawn/kill/IO per terminal tile
├── ProfileManager  — profile list, active profile, tile snapshots for inactive profiles
├── SessionManager  — save/restore session JSON (userData/session.json)
└── ModeManager     — INSERT vs TILE state, broadcasts mode:changed

Renderer Process (React + Vite)
├── App             — root; owns mode, layout, profile state from main via IPC; global key handler
├── TileGrid        — renders all 5 workspaces (inactive hidden), tiles at calculated bounds
├── BrowserTile     — URL bar chrome (36px) + placeholder div; native view floats above
├── TerminalTile    — xterm.js instance, PTY data over IPC
└── StatusBar       — mode pill, workspace tabs 1–5, profile selector dropdown
```

**WebContentsView rule**: bounds are set in main process only. Renderer sends `tile:resize` via IPC; main applies it. React draws a placeholder div at the same position; the real WebContentsView floats on top.

**node-pty rule**: run `electron-rebuild` in postinstall. Skipping this silently breaks all terminal tiles.

**xterm.js rule**: call `terminal.open(el)` only after the container has non-zero pixel dimensions.

**Context isolation**: use `contextBridge` in preload to expose IPC. Never set `nodeIntegration: true`.

## Session Schema
```json
{
  "mode": "TILE",
  "activeProfileId": "uuid",
  "profiles": [
    {
      "id": "uuid",
      "name": "Default",
      "activeWorkspace": 1,
      "workspaces": {
        "1": { "tiles": [
          { "id": "uuid", "type": "browser", "url": "https://..." },
          { "id": "uuid", "type": "terminal" }
        ]},
        "2": { "tiles": [] }
      }
    }
  ]
}
```
Save on `app.before-quit`. Restore on launch. `ProfileManager.loadFrom()` rehydrates profiles; `TileManager.restore()` rehydrates the active profile's tiles. Graceful fallback if file missing or malformed.

## Build Order (24h)
1. `electron-vite` scaffold → single WebContentsView → single terminal tile working
2. `TileManager` auto-split math → `TileGrid` renders equal columns → `tile:resize` IPC
3. `ModeManager` → `Option+Space` global toggle → `Shift+Space` mode toggle → `StatusBar`
4. Focus navigation (A/D/H/L/arrows) → `B`/`T` spawn → `Q` close
5. Browser tile URL bar + back/forward/reload
6. `SessionManager` save/restore including mode
7. Focused tile glow → demo polish
8. `ProfileManager` → profile create/rename/delete → profile selector in `StatusBar` → `P` key → `browser:set-overlay` for native view hiding