'use client'

// ============================================================================
// AttachClipsModal — pick clips from the user's library to attach to the
// next conversational message. Multi-select up to MAX_PICKABLE.
//
// We list the user's last 100 clips via GET /api/clips (server enforces
// `user_id` ownership). Selecting clips never sends them to the LLM directly:
// the parent component holds the chip strip and the conversational route
// re-validates ownership before any prompt injection.
// ============================================================================

import { useState, useEffect, useMemo } from 'react'
import { Search, X, Check } from 'lucide-react'

export type AttachableClip = {
  id: string
  product_name: string
  brand?: string | null
  image_url?: string | null
  source_domain?: string | null
}

const MAX_PICKABLE = 10

export function AttachClipsModal({
  open,
  onClose,
  currentlyAttachedIds,
  onAttach,
}: {
  open: boolean
  onClose: () => void
  currentlyAttachedIds: string[]
  onAttach: (clips: AttachableClip[]) => void
}) {
  const [clips, setClips] = useState<AttachableClip[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  // Fetch clips when the modal opens.
  useEffect(() => {
    if (!open) return

    let cancelled = false
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setSelected(new Set())
    setQuery('')

    ;(async () => {
      try {
        const res = await fetch('/api/clips', {
          credentials: 'same-origin',
          signal: controller.signal,
        })
        if (cancelled) return
        if (!res.ok) {
          setError('Could not load your clips.')
          setLoading(false)
          return
        }
        const data = await res.json()
        if (cancelled) return
        const list: AttachableClip[] = Array.isArray(data.clips)
          ? data.clips
              .filter(
                (c: Record<string, unknown>) =>
                  typeof c.id === 'string' && typeof c.product_name === 'string'
              )
              .map((c: Record<string, unknown>) => ({
                id: String(c.id),
                product_name: String(c.product_name),
                brand: typeof c.brand === 'string' ? c.brand : null,
                image_url: typeof c.image_url === 'string' ? c.image_url : null,
                source_domain:
                  typeof c.source_domain === 'string' ? c.source_domain : null,
              }))
          : []
        setClips(list)
        setLoading(false)
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return
        if (!cancelled) {
          setError('Network error.')
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [open])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clips
    return clips.filter((c) => {
      const hay = `${c.product_name} ${c.brand ?? ''} ${c.source_domain ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [clips, query])

  const remainingSlots = Math.max(
    0,
    MAX_PICKABLE - currentlyAttachedIds.length - selected.size
  )

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        return next
      }
      // Respect the cap (already-attached + currently-selected).
      if (next.size + currentlyAttachedIds.length >= MAX_PICKABLE) return prev
      next.add(id)
      return next
    })
  }

  const handleConfirm = () => {
    const picked = clips.filter((c) => selected.has(c.id))
    onAttach(picked)
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(42,30,24,0.4)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: 'var(--font-plus-jakarta-sans), sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '80vh',
          background: 'var(--ds-bg-card)',
          borderRadius: 14,
          border: '0.5px solid var(--ds-border-12)',
          boxShadow: '0 12px 40px rgba(42,30,24,.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '0.5px solid var(--ds-border-07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: 'var(--ds-text-primary)',
              }}
            >
              Attach products
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--ds-text-muted)',
                marginTop: 2,
              }}
            >
              {remainingSlots} of {MAX_PICKABLE} slots remaining
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              color: 'var(--ds-text-secondary)',
              display: 'flex',
            }}
          >
            <X size={16} strokeWidth={1.7} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px 6px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              background: 'var(--ds-bg-page)',
              border: '0.5px solid var(--ds-border-12)',
              borderRadius: 8,
            }}
          >
            <Search size={14} strokeWidth={1.7} style={{ color: 'var(--ds-text-muted)' }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value.slice(0, 100))}
              placeholder="Search by product, brand, or store…"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 13,
                color: 'var(--ds-text-primary)',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 8px' }}>
          {loading ? (
            <EmptyState text="Loading your clips…" />
          ) : error ? (
            <EmptyState text={error} />
          ) : filtered.length === 0 ? (
            <EmptyState
              text={
                clips.length === 0
                  ? 'You haven\u2019t clipped any products yet.'
                  : 'No clips match your search.'
              }
            />
          ) : (
            filtered.map((clip) => {
              const isSelected = selected.has(clip.id)
              const isAlreadyAttached = currentlyAttachedIds.includes(clip.id)
              const isCapReached =
                !isSelected &&
                !isAlreadyAttached &&
                selected.size + currentlyAttachedIds.length >= MAX_PICKABLE

              return (
                <ClipRow
                  key={clip.id}
                  clip={clip}
                  selected={isSelected}
                  alreadyAttached={isAlreadyAttached}
                  disabled={isCapReached}
                  onToggle={() => !isAlreadyAttached && !isCapReached && toggle(clip.id)}
                />
              )
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '0.5px solid var(--ds-border-07)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '0.5px solid var(--ds-border-12)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              color: 'var(--ds-text-secondary)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            style={{
              background: selected.size > 0 ? 'var(--ds-accent)' : 'var(--ds-bg-hover)',
              color: selected.size > 0 ? '#fff' : 'var(--ds-text-muted)',
              border: 'none',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 500,
              cursor: selected.size > 0 ? 'pointer' : 'default',
              fontFamily: 'inherit',
              transition: 'background 150ms',
            }}
          >
            {selected.size === 0 ? 'Attach' : `Attach ${selected.size}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ClipRow({
  clip,
  selected,
  alreadyAttached,
  disabled,
  onToggle,
}: {
  clip: AttachableClip
  selected: boolean
  alreadyAttached: boolean
  disabled: boolean
  onToggle: () => void
}) {
  const dimmed = alreadyAttached || disabled

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={alreadyAttached || disabled}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '8px 10px',
        margin: '2px 0',
        borderRadius: 8,
        border: 'none',
        cursor: alreadyAttached || disabled ? 'default' : 'pointer',
        background: selected ? 'var(--ds-accent-light)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        opacity: dimmed && !selected ? 0.45 : 1,
        fontFamily: 'inherit',
        transition: 'background 120ms',
      }}
      onMouseEnter={(e) => {
        if (!selected && !dimmed) e.currentTarget.style.background = 'var(--ds-bg-hover)'
      }}
      onMouseLeave={(e) => {
        if (!selected && !dimmed) e.currentTarget.style.background = 'transparent'
      }}
    >
      {/* Thumbnail */}
      {clip.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={clip.image_url}
          alt=""
          style={{
            width: 36,
            height: 36,
            borderRadius: 6,
            objectFit: 'cover',
            flexShrink: 0,
            background: 'var(--ds-bg-image)',
          }}
        />
      ) : (
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 6,
            background: 'var(--ds-bg-image)',
            flexShrink: 0,
          }}
        />
      )}

      {/* Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: 'var(--ds-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 500,
          }}
        >
          {clip.product_name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--ds-text-muted)',
            marginTop: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {[clip.brand, clip.source_domain].filter(Boolean).join(' · ') || '—'}
        </div>
      </div>

      {/* Status indicator */}
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          flexShrink: 0,
          border: selected
            ? '0px solid transparent'
            : '0.5px solid var(--ds-border-20)',
          background: selected ? 'var(--ds-accent)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {(selected || alreadyAttached) && (
          <Check size={12} strokeWidth={2.4} color="#fff" />
        )}
      </div>
    </button>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '40px 16px',
        color: 'var(--ds-text-muted)',
        fontSize: 13,
      }}
    >
      {text}
    </div>
  )
}
