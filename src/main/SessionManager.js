import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'

// SessionManager is the only thing in the app that touches the session file.
// It turns our in-memory state into JSON on disk and back, and swallows every
// disk/parse error into a clean "no session" result so the rest of main never
// has to care whether a save exists or is readable. Shape validation lives
// downstream: ProfileManager.loadFrom and TileManager.restore are already
// defensive about unexpected/missing fields.
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
  // restore (file missing on first launch, unreadable, or corrupt JSON).
  // Callers treat null as "boot the defaults".
  load() {
    try {
      return JSON.parse(readFileSync(this._path(), 'utf-8'))
    } catch {
      return null
    }
  }

  // Persist a state snapshot. Errors are logged but never thrown: a failed
  // save must not block app shutdown.
  save(state) {
    try {
      writeFileSync(this._path(), JSON.stringify(state, null, 2), 'utf-8')
    } catch (err) {
      console.error('[SessionManager] failed to save session:', err)
    }
  }
}
