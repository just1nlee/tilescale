import { useEffect, useRef, useState } from 'react'

// Small square icon button used for the per-profile rename/delete affordances.
const iconButtonStyle = {
  width: '20px',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(255, 255, 255, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  borderRadius: '4px',
  color: '#f0f0f0',
  fontFamily: 'monospace',
  fontSize: '11px',
  lineHeight: 1,
  cursor: 'pointer',
  padding: 0,
}

function StatusBar({
  mode,
  workspace,
  profiles = [],
  activeProfileId,
  onSelectProfile,
  onCreateProfile,
  onRenameProfile,
  onDeleteProfile,
  open = false,
  onOpenChange,
  highlightedId,
  onHighlightChange
}) {
  const isInsert = mode === 'INSERT'
  const modeStyle = isInsert
    ? { bg: 'rgba(255, 176, 64, 0.18)', text: '#ffcf80', border: 'rgba(255, 176, 64, 0.45)' }
    : { bg: 'rgba(94, 158, 255, 0.18)', text: '#9ec5ff', border: 'rgba(94, 158, 255, 0.45)' }
  const modeLabel = isInsert ? 'Insert' : 'Tile'

  // Dropdown open/close and the keyboard highlight cursor are CONTROLLED by App
  // (open via the P key, highlight via W/S/J/K) because App captures all
  // keydowns at the window level in TILE mode — the dropdown can't listen for
  // keys itself. The inline "new profile" name field stays local UI state.
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  // Which profile row is being renamed inline, plus its working text.
  const [renamingId, setRenamingId] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')
  const wrapRef = useRef(null)

  // Whenever the dropdown closes (via the P key, Escape, outside-click, or a
  // selection), drop any half-finished create/rename so it doesn't reappear the
  // next time it opens.
  useEffect(() => {
    if (!open) {
      setCreating(false)
      setDraftName('')
      setRenamingId(null)
      setRenameDraft('')
    }
  }, [open])

  // Click anywhere outside the selector wrapper closes the dropdown. Using
  // mousedown (not click) so it fires before any inner button's onClick, which
  // matters if a tile click is what's closing us.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        onOpenChange?.(false)
        setCreating(false)
        setDraftName('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, onOpenChange])

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]

  const submitCreate = () => {
    onCreateProfile?.(draftName)
    setDraftName('')
    setCreating(false)
    onOpenChange?.(false)
  }

  const startRename = (profile) => {
    setRenamingId(profile.id)
    setRenameDraft(profile.name)
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenameDraft('')
  }

  const submitRename = () => {
    const trimmed = renameDraft.trim()
    if (trimmed) onRenameProfile?.(renamingId, trimmed)
    cancelRename()
  }

  return (
    <div style={{
      flexShrink: 0,
      position: 'relative',
      height: '36px',
      background: 'rgba(20, 20, 20, 0.55)',
      border: '1px solid rgba(255, 255, 255, 0.18)',
      borderRadius: '10px',
      margin: '0 8px 8px 8px',
      padding: '0 12px',
      boxSizing: 'border-box',
      color: '#f0f0f0',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '13px',
      fontFamily: 'monospace',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
    }}>
      {/* Brand mark: absolutely centered so it sits at the true midpoint of
          the bar independent of the flex children's widths. pointer-events
          none lets clicks fall through to whatever is under it (the profile
          selector lives in the same horizontal zone). */}
      <span style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        color: 'rgba(255, 255, 255, 0.35)',
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '2.5px',
        textTransform: 'uppercase',
        lineHeight: 1,
        userSelect: 'none',
      }}>
        Tilescale
      </span>
      {/* Fixed-width slot reserves the space for the longest label so the
          workspace indicators never shift, while the pill inside hugs its own
          text — TILE renders a narrower pill than INSERT. */}
      <div style={{ width: '64px', flexShrink: 0, display: 'flex' }}>
        <span style={{
          background: modeStyle.bg,
          color: modeStyle.text,
          border: `1px solid ${modeStyle.border}`,
          borderRadius: '5px',
          padding: '2px 8px',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}>
          {modeLabel}
        </span>
      </div>
      <div style={{
        display: 'flex',
        gap: '2px',
        height: '100%',
        alignItems: 'stretch',
      }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n === workspace
          return (
            <div
              key={n}
              style={{
                minWidth: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderTop: `2px solid ${active ? modeStyle.text : 'transparent'}`,
                background: active ? 'rgba(255, 255, 255, 0.07)' : 'transparent',
                color: active ? '#f0f0f0' : 'rgba(255, 255, 255, 0.4)',
                fontSize: '12px',
                fontWeight: active ? 600 : 500,
                transition: 'color 120ms ease, background 120ms ease',
              }}
            >
              {n}
            </div>
          )
        })}
      </div>

      <div
        ref={wrapRef}
        style={{ marginLeft: 'auto', position: 'relative' }}
      >
        <button
          type="button"
          onClick={() => onOpenChange?.(!open)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '5px',
            padding: '3px 8px',
            color: '#f0f0f0',
            fontFamily: 'monospace',
            fontSize: '12px',
            lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          <span style={{
            color: 'rgba(255, 255, 255, 0.45)',
            fontSize: '10px',
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
          }}>
            Profile
          </span>
          <span style={{ fontWeight: 600 }}>{activeProfile?.name ?? 'Default'}</span>
          <span style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '9px',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 120ms ease',
          }}>
            ▾
          </span>
        </button>

        {open && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              bottom: 'calc(100% + 6px)',
              minWidth: '180px',
              background: 'rgba(28, 28, 28, 0.96)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '8px',
              padding: '4px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(20px) saturate(160%)',
              WebkitBackdropFilter: 'blur(20px) saturate(160%)',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              zIndex: 10,
            }}
          >
            {profiles.map((p) => {
              const active = p.id === activeProfileId
              const highlighted = p.id === highlightedId

              // Renaming this row: swap it for an inline text field. Rows are
              // divs (not buttons) so we can nest the rename/delete buttons —
              // nesting <button> inside <button> is invalid HTML.
              if (renamingId === p.id) {
                return (
                  <form
                    key={p.id}
                    onSubmit={(e) => {
                      e.preventDefault()
                      submitRename()
                    }}
                    style={{ display: 'flex', gap: '4px', padding: '2px' }}
                  >
                    <input
                      autoFocus
                      data-profile-name-input="true"
                      maxLength={16}
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') cancelRename()
                      }}
                      spellCheck={false}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        borderRadius: '5px',
                        color: '#f0f0f0',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        padding: '4px 6px',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!renameDraft.trim()}
                      style={{
                        background: 'rgba(94, 158, 255, 0.18)',
                        border: '1px solid rgba(94, 158, 255, 0.45)',
                        borderRadius: '5px',
                        color: '#9ec5ff',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        padding: '0 8px',
                        cursor: renameDraft.trim() ? 'pointer' : 'default',
                        opacity: renameDraft.trim() ? 1 : 0.5,
                      }}
                    >
                      Save
                    </button>
                  </form>
                )
              }

              return (
                <div
                  key={p.id}
                  onMouseEnter={() => onHighlightChange?.(p.id)}
                  onClick={() => {
                    onSelectProfile?.(p.id)
                    onOpenChange?.(false)
                  }}
                  style={{
                    background: active
                      ? 'rgba(94, 158, 255, 0.18)'
                      : highlighted
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'transparent',
                    border: highlighted
                      ? '1px solid rgba(255, 255, 255, 0.3)'
                      : '1px solid transparent',
                    borderRadius: '5px',
                    padding: '6px 8px',
                    color: active ? '#9ec5ff' : '#f0f0f0',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {/* Action buttons reveal on the hovered/highlighted row.
                        stopPropagation keeps a click from also selecting the
                        row (which would switch profile + close the dropdown).
                        Rendered BEFORE the checkmark so the checkmark stays
                        pinned to the row's right edge — the action group
                        grows leftward when hovered, leaving the rightmost
                        slot untouched. */}
                    {highlighted && (
                      <>
                        <button
                          type="button"
                          title="Rename"
                          onClick={(e) => {
                            e.stopPropagation()
                            startRename(p)
                          }}
                          style={iconButtonStyle}
                        >
                          ✎
                        </button>
                        {profiles.length > 1 && (
                          <button
                            type="button"
                            title="Delete"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteProfile?.(p.id)
                            }}
                            style={{ ...iconButtonStyle, color: '#ff9b9b' }}
                          >
                            ✕
                          </button>
                        )}
                      </>
                    )}
                    {active && <span style={{ fontSize: '11px' }}>✓</span>}
                  </div>
                </div>
              )
            })}

            <div style={{
              height: '1px',
              background: 'rgba(255, 255, 255, 0.1)',
              margin: '4px 4px',
            }} />

            {creating ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  submitCreate()
                }}
                style={{ display: 'flex', gap: '4px', padding: '2px' }}
              >
                <input
                  autoFocus
                  data-profile-name-input="true"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setCreating(false)
                      setDraftName('')
                    }
                  }}
                  placeholder="Profile name"
                  spellCheck={false}
                  maxLength={16}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    borderRadius: '5px',
                    color: '#f0f0f0',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    padding: '4px 6px',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={!draftName.trim()}
                  style={{
                    background: 'rgba(94, 158, 255, 0.18)',
                    border: '1px solid rgba(94, 158, 255, 0.45)',
                    borderRadius: '5px',
                    color: '#9ec5ff',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    padding: '0 8px',
                    cursor: draftName.trim() ? 'pointer' : 'default',
                    opacity: draftName.trim() ? 1 : 0.5,
                  }}
                >
                  Add
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                style={{
                  textAlign: 'left',
                  background: 'transparent',
                  border: '1px solid transparent',
                  borderRadius: '5px',
                  padding: '6px 8px',
                  color: 'rgba(255, 255, 255, 0.65)',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                + New profile…
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default StatusBar
