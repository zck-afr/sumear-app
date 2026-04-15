'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const jakarta = 'var(--font-plus-jakarta-sans), sans-serif'

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

const EMOJI_SUGGESTIONS = ['📦', '🛍️', '🏠', '💻', '👗', '🎮', '🍳', '🌿', '✈️', '🎁']

export function NewProjectButton({ label = 'Nouveau projet' }: { label?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📦')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setEmoji('📦')
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
    if (!trimmed) { setError('Le nom du projet est requis.'); return }
    if (trimmed.length > 100) { setError('100 caractères max.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, emoji }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création.')
        setLoading(false)
        return
      }
      setOpen(false)
      router.push(`/projects/${data.project.id}`)
      router.refresh()
    } catch {
      setError('Erreur réseau. Réessayez.')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--accent)', color: '#fff',
          borderRadius: 20, padding: '9px 18px',
          fontSize: 12, fontWeight: 500, fontFamily: jakarta,
          border: 'none', cursor: 'pointer',
          marginTop: 8, flexShrink: 0,
        }}
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
              Nouveau projet
            </h2>

            {/* Emoji picker */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px' }}>Icône</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EMOJI_SUGGESTIONS.map(e => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    style={{
                      fontSize: 20, width: 36, height: 36,
                      borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: emoji === e ? 'var(--accent-light)' : 'var(--bg-secondary)',
                      outline: emoji === e ? '2px solid var(--accent)' : 'none',
                      transition: 'background .1s',
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Name input */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 6px' }}>Nom</p>
              <input
                ref={inputRef}
                value={name}
                onChange={e => { setName(e.target.value); setError('') }}
                onKeyDown={e => { if (e.key === 'Enter' && !loading) handleCreate() }}
                maxLength={100}
                placeholder="Ex : Cuisine, PC Gaming, Déco chambre…"
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
                Annuler
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
                {loading ? 'Création…' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
