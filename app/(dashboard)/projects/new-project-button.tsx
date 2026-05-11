'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const jakarta = 'var(--font-plus-jakarta-sans), sans-serif'

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function NewProjectButton({
  label = 'New project',
  variant = 'outline',
}: {
  label?: string
  /** `primary` = accent fill (e.g. empty state CTA); `outline` = header style */
  variant?: 'outline' | 'primary'
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setError('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) { setError('Project name is required.'); return }
    if (trimmed.length > 100) { setError('100 characters max.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, emoji: null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create project.')
        setLoading(false)
        return
      }
      setOpen(false)
      router.push(`/projects/${data.project.id}`)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={
          variant === 'primary'
            ? {
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'var(--accent)', color: '#fff',
                borderRadius: 20, padding: '10px 20px',
                fontSize: 13, fontWeight: 500, fontFamily: jakarta,
                border: 'none', cursor: 'pointer',
                flexShrink: 0,
              }
            : {
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'transparent', color: 'var(--text-primary)',
                borderRadius: 20, padding: '9px 18px',
                fontSize: 12, fontWeight: 500, fontFamily: jakarta,
                border: '1px solid var(--border-md)', cursor: 'pointer',
                flexShrink: 0,
              }
        }
      >
        <PlusIcon />
        {label}
      </button>

      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(42,30,24,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 16,
            padding: '28px 28px 24px',
            width: '100%', maxWidth: 380,
            boxShadow: '0 12px 40px rgba(42,30,24,.18)',
            fontFamily: jakarta,
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              New project
            </h2>

            {/* Name input */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 6px' }}>Name</p>
              <input
                ref={inputRef}
                value={name}
                onChange={e => { setName(e.target.value); setError('') }}
                onKeyDown={e => { if (e.key === 'Enter' && !loading) handleCreate() }}
                maxLength={100}
                placeholder="e.g. Kitchen, Gaming PC, Bedroom decor…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '9px 12px', borderRadius: 10, fontSize: 13,
                  border: '1px solid var(--border-md)',
                  background: 'var(--bg-page)',
                  color: 'var(--text-primary)',
                  fontFamily: jakarta,
                  outline: 'none',
                }}
              />
              {error && (
                <p style={{ fontSize: 11, color: '#C07070', margin: '6px 0 0' }}>{error}</p>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setOpen(false)}
                style={{
                  padding: '8px 16px', borderRadius: 20, fontSize: 12,
                  border: '1px solid var(--border-md)',
                  background: 'transparent', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontFamily: jakarta,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || !name.trim()}
                style={{
                  padding: '8px 18px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                  background: loading || !name.trim() ? 'var(--accent-light)' : 'var(--accent)',
                  color: loading || !name.trim() ? 'var(--accent)' : '#fff',
                  border: 'none', cursor: loading || !name.trim() ? 'default' : 'pointer',
                  fontFamily: jakarta, transition: 'background .15s',
                }}
              >
                {loading ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
