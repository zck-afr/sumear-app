'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const fraunces = 'var(--font-fraunces), serif'
const jakarta  = 'var(--font-plus-jakarta-sans), sans-serif'
const playfair = 'var(--font-playfair-display), Georgia, serif'

interface Session {
  id: string
  title: string
  created_at: string
  updated_at: string
  first_message: string | null
  message_count: number
  product_name: string | null
  product_price: number | null
  product_image: string | null
  is_comparison: boolean
}

type DateGroup = 'Cette semaine' | 'Le mois dernier' | 'Plus ancien'
const GROUP_ORDER: DateGroup[] = ['Cette semaine', 'Le mois dernier', 'Plus ancien']

function getDateGroup(isoDate: string): DateGroup {
  const diffDays = (Date.now() - new Date(isoDate).getTime()) / 86400000
  if (diffDays <= 7)  return 'Cette semaine'
  if (diffDays <= 30) return 'Le mois dernier'
  return 'Plus ancien'
}

function formatRelativeDate(isoDate: string): string {
  const diffDays = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000)
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  return new Date(isoDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price)
}

function Thumbnail({ session }: { session: Session }) {
  const label = session.product_name || session.title || '?'

  if (session.product_image) {
    return (
      <div style={{
        width: 32, height: 32, borderRadius: 6,
        background: 'var(--bg-secondary)',
        flexShrink: 0, overflow: 'hidden',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={session.product_image}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    )
  }

  return (
    <div style={{
      width: 32, height: 32, borderRadius: 6,
      background: 'var(--bg-secondary)',
      flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
      fontFamily: jakarta,
    }}>
      {label.charAt(0).toUpperCase()}
    </div>
  )
}

function SessionCard({ session, onClick }: { session: Session; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  const priceLabel = session.is_comparison
    ? 'Comparaison'
    : session.product_price != null
      ? formatPrice(session.product_price)
      : null

  const msgLabel = session.message_count === 1
    ? '1 message'
    : `${session.message_count} messages`

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--bg-secondary)' : 'var(--bg-card)',
        borderRadius: 12,
        border: '0.5px solid var(--border-md)',
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'background .15s',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Thumbnail session={session} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            fontSize: 11, fontWeight: 500,
            color: 'var(--text-primary)',
            margin: 0,
            display: 'block',
            maxWidth: '100%',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: jakarta,
          }}>
            {session.product_name || session.title || 'Discussion'}
          </p>
          {priceLabel && (
            <p style={{
              fontSize: 11,
              fontFamily: playfair,
              color: 'var(--accent)',
              margin: '1px 0 0',
            }}>
              {priceLabel}
            </p>
          )}
        </div>
      </div>

      {/* Question preview */}
      {session.first_message && (
        <p style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          lineHeight: 1.4,
          margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          wordBreak: 'break-word',
          fontFamily: jakarta,
        }}>
          «&nbsp;{session.first_message}&nbsp;»
        </p>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: jakarta }}>
          {formatRelativeDate(session.updated_at || session.created_at)}
        </span>
        {session.message_count > 0 && (
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: jakarta }}>
            {msgLabel}
          </span>
        )}
      </div>
    </div>
  )
}

export default function HistoriquePage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading]   = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch('/api/chat/sessions')
        if (!res.ok) return
        const data = await res.json()
        setSessions(data.sessions ?? [])
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()
  }, [])

  const grouped = sessions.reduce<Partial<Record<DateGroup, Session[]>>>((acc, s) => {
    const g = getDateGroup(s.created_at)
    if (!acc[g]) acc[g] = []
    acc[g]!.push(s)
    return acc
  }, {})

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      overflowX: 'hidden',
    }}>
      {/* Page title */}
      <div>
        <span style={{
          display: 'block',
          fontFamily: fraunces,
          fontSize: 36, fontWeight: 300, fontStyle: 'italic',
          color: 'var(--text-primary)',
          letterSpacing: '-.4px', lineHeight: 1.1,
        }}>
          Historique,
        </span>
        <span style={{
          display: 'block',
          fontFamily: fraunces,
          fontSize: 22, fontWeight: 300,
          color: 'var(--accent)',
          lineHeight: 1.1,
        }}>
          vos discussions 💬
        </span>
        <p style={{
          fontSize: 12, color: 'var(--text-muted)',
          marginTop: 8, marginBottom: 28,
          fontFamily: jakarta,
        }}>
          Cliquez sur une discussion pour la rouvrir.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div style={{
            width: 20, height: 20,
            borderRadius: '50%',
            border: '2px solid var(--border-md)',
            borderTopColor: 'var(--accent)',
            animation: 'hs-spin .7s linear infinite',
          }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && sessions.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 12,
          padding: '60px 0',
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="5" y="3" width="22" height="26" rx="3"
              stroke="var(--text-muted)" strokeWidth="1.5" />
            <path d="M10 10h12M10 15h12M10 20h8"
              stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, fontFamily: jakarta }}>
            Aucune discussion pour l&apos;instant.
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, opacity: 0.7, fontFamily: jakarta }}>
            Analysez un produit depuis l&apos;extension pour démarrer.
          </p>
        </div>
      )}

      {/* Grouped sessions */}
      {!loading && sessions.length > 0 && (
        <div>
          {GROUP_ORDER.filter(g => (grouped[g]?.length ?? 0) > 0).map((group, i) => (
            <div key={group} style={{ marginTop: i > 0 ? 24 : 0 }}>
              <p style={{
                fontSize: 10, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '.6px',
                color: 'var(--text-secondary)',
                marginBottom: 12, marginTop: 0,
                fontFamily: jakarta,
              }}>
                {group}
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 8,
                marginBottom: 8,
                overflow: 'hidden',
              }}>
                {grouped[group]!.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onClick={() => router.push(`/chat?session_id=${session.id}`)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes hs-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
