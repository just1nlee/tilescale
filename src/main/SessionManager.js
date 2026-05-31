import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'

// Bump this whenever the on-disk shape changes incompatibly. load() refuses to
// restore a file whose version doesn't match, so an old/foreign session can
// never feed malformed tiles into TileManager — we just start fresh instead.
const SCHEMA_VERSION = 1

// SessionManager is the only thing in the app that touches the session file.
// It turns our in-memory state into JSON on disk and back, and swallows every
// disk/parse error into a clean "no session" result so the rest of main never
// has to care whether a save exists, is readable, or is the right version.
export default class SessionManager {
  constructor() {
    // Resolved lazily: managers are constructed at import time, before the app
    // is ready, but app.getPath('userData') only works once it is.
    this._filePath = null
  }

  _path() {
    if (!this._filePath) this._filePath = join(app.getPath('userData'), 'session.json')
    return this._filePath
  }

  // Returns the saved session object, or null if there's nothing usable to
  // restore (file missing on first launch, unreadable, corrupt JSON, or a
  // version we don't understand). Callers treat null as "boot the defaults".
  load() {
    try {
      const data = JSON.parse(readFileSync(this._path(), 'utf-8'))
      if (data?.version !== SCHEMA_VERSION) return null
      return data
    } catch {
      return null
    }
  }

  // Persist a state snapshot. We stamp the version here so callers only supply
  // the meaningful fields (mode, activeWorkspace, workspaces). Errors are
  // logged but never thrown: a failed save must not block app shutdown.
  save(state) {
    try {
      const data = { version: SCHEMA_VERSION, ...state }
      writeFileSync(this._path(), JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      console.error('[SessionManager] failed to save session:', err)
    }
  }
}
