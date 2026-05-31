import { randomUUID } from 'crypto'

// Hard cap on profiles. Keeps the StatusBar dropdown sane and leaves room to
// later bind number keys (1–9) to direct profile selection if we want.
const MAX_PROFILES = 9

// A profile's "snapshot" is exactly the per-profile slice that TileManager
// already knows how to restore: which workspace was active and the tile array
// for each of the 5 workspaces. An empty snapshot is the launch default — five
// empty workspaces with workspace 1 active.
function emptySnapshot() {
  const workspaces = {}
  for (let i = 1; i <= 5; i++) workspaces[i] = { tiles: [] }
  return { activeWorkspace: 1, workspaces }
}

// Pull just {activeWorkspace, workspaces} out of an untrusted persisted profile
// object, clamping to sane defaults. We don't validate individual tiles here —
// TileManager.restore() is already defensive about tile shape/type/count — we
// only guarantee the two top-level keys exist so restore() never sees undefined.
function normalizeSnapshot(source) {
  const ws = source?.activeWorkspace
  return {
    activeWorkspace: ws >= 1 && ws <= 5 ? ws : 1,
    workspaces: source?.workspaces ?? {}
  }
}

// ProfileManager is the main-process owner of the profile map — the profile
// counterpart to TileManager's workspace map. It holds an ordered list of
// profile metadata, which profile is active, and a saved snapshot of tiles for
// each profile. The live tiles of the ACTIVE profile live in TileManager; this
// class only stores the frozen snapshots of the others (and the active one's
// last-captured state). It is pure data: no tiles, ptys, IPC, or disk here.
export default class ProfileManager {
  constructor() {
    const id = 'default'
    this.activeId = id
    // Ordered so the StatusBar dropdown and the cycle keybinding share one
    // stable sequence.
    this.profiles = [{ id, name: 'Default' }]
    // id -> snapshot ({ activeWorkspace, workspaces })
    this.snapshots = { [id]: emptySnapshot() }
  }

  // Metadata the renderer needs to draw the selector. Snapshots stay in main.
  list() {
    return this.profiles.map((p) => ({ id: p.id, name: p.name }))
  }

  getActiveId() {
    return this.activeId
  }

  has(id) {
    return this.profiles.some((p) => p.id === id)
  }

  // The tiles to hand TileManager.restore() when this profile becomes active.
  getSnapshot(id) {
    return this.snapshots[id] ?? null
  }

  // Freeze the active profile's live tiles before we switch away (or quit), so
  // the snapshot on disk / in memory reflects what the user last had open.
  setSnapshot(id, snapshot) {
    if (!this.has(id)) return
    this.snapshots[id] = snapshot ? normalizeSnapshot(snapshot) : emptySnapshot()
  }

  // Add a new, empty profile and return its metadata. Does NOT switch to it —
  // the caller decides whether to follow the create with a switch. Returns null
  // if we're at the cap so the caller can ignore the request quietly.
  create(name) {
    if (this.profiles.length >= MAX_PROFILES) return null
    const trimmed = (name ?? '').trim() || `Profile ${this.profiles.length + 1}`
    const id = randomUUID()
    this.profiles.push({ id, name: trimmed })
    this.snapshots[id] = emptySnapshot()
    return { id, name: trimmed }
  }

  setActive(id) {
    if (this.has(id)) this.activeId = id
  }

  // Id of the profile `step` positions from the active one, wrapping around.
  // Drives the cycle keybinding (+1 = next, -1 = previous).
  cycle(step) {
    const idx = this.profiles.findIndex((p) => p.id === this.activeId)
    const len = this.profiles.length
    const next = ((idx + step) % len + len) % len
    return this.profiles[next].id
  }

  // Rehydrate from an already-version-checked persisted object. Bad/empty data
  // leaves the constructor's single Default profile untouched.
  loadFrom(persisted) {
    const list = Array.isArray(persisted?.profiles) ? persisted.profiles : []
    const clean = list.filter((p) => p && p.id && typeof p.name === 'string')
    if (clean.length === 0) return

    this.profiles = clean.map((p) => ({ id: p.id, name: p.name }))
    this.snapshots = {}
    for (const p of clean) this.snapshots[p.id] = normalizeSnapshot(p)
    this.activeId = this.has(persisted?.activeProfileId)
      ? persisted.activeProfileId
      : this.profiles[0].id
  }

  // The profile slice of the on-disk session. SessionManager stamps the version
  // and layers in the global mode; we own only profiles + which one is active.
  // Each profile is flattened to { id, name, activeWorkspace, workspaces }.
  toPersisted() {
    return {
      activeProfileId: this.activeId,
      profiles: this.profiles.map((p) => ({
        id: p.id,
        name: p.name,
        ...(this.snapshots[p.id] ?? emptySnapshot())
      }))
    }
  }
}
