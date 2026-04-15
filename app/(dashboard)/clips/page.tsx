'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/theme-provider'

interface Clip {
  id: string
  product_name: string
  brand: string | null
  source_domain: string
  source_url: string
  image_url: string | null
  price: number | null
  currency: string
  rating: number | null
  review_count: number | null
  created_at: string
}

const fraunces = 'var(--font-fraunces), Georgia, serif'
const playfair = 'var(--font-playfair-display), Georgia, serif'
const jakarta = 'var(--font-plus-jakarta-sans), sans-serif'

export default function ClipsPage() {
  const [clips, setClips] = useState<Clip[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterDomain, setFilterDomain] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function fetchClips() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from('clips')
        .select('id, product_name, brand, source_domain, source_url, image_url, price, currency, rating, review_count, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (data) setClips(data)
      if (error) setError('Erreur lors du chargement.')
      setLoading(false)
    }
    fetchClips()
  }, [])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 5) next.add(id)
      return next
    })
  }

  const domains = useMemo(() => {
    const set = new Set(clips.map(c => c.source_domain).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [clips])

  const filteredClips = useMemo(() => {
    if (!filterDomain) return clips
    return clips.filter(c => c.source_domain === filterDomain)
  }, [clips, filterDomain])

  async function handleDeleteClip(clipId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('Supprimer ce produit de vos clips ?')) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error: delErr } = await supabase
      .from('clips')
      .delete()
      .eq('id', clipId)
      .eq('user_id', user.id)
    if (delErr) {
      setError('Impossible de supprimer ce clip.')
      return
    }
    setClips(prev => prev.filter(c => c.id !== clipId))
    setSelected(prev => {
      const next = new Set(prev)
      next.delete(clipId)
      return next
    })
    setError(null)
  }

  function openChatWithClips(ids: string[]) {
    if (ids.length === 0) return
    router.push(`/chat?clips=${ids.join(',')}`)
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: '50vh' }}
      >
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: 'var(--border-md)', borderTopColor: 'var(--accent)' }}
        />
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 6,
        }}
      >
        <div>
          <span
            style={{
              display: 'block',
              fontFamily: fraunces,
              fontWeight: 300,
              fontStyle: 'italic',
              fontSize: 34,
              color: 'var(--text-primary)',
              letterSpacing: '-0.4px',
              lineHeight: 1.1,
            }}
          >
            Mes produits,
          </span>
          <span
            style={{
              display: 'block',
              fontFamily: fraunces,
              fontWeight: 300,
              fontStyle: 'normal',
              fontSize: 20,
              color: 'var(--accent)',
              marginTop: 2,
            }}
          >
            vos clips sauvegardés 📎
          </span>
          <p
            style={{
              marginTop: 6,
              fontSize: 12,
              color: 'var(--text-muted)',
              fontFamily: jakarta,
            }}
          >
            Analysez vos produits sauvegardés.
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 13,
            fontFamily: jakarta,
            background: 'rgba(192,112,112,.12)',
            border: '0.5px solid rgba(192,112,112,.25)',
            color: '#C07070',
          }}
        >
          {error}
        </div>
      )}

      {clips.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Filters */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 7,
              marginBottom: 28,
            }}
          >
            <FilterPill
              label="Tous"
              active={filterDomain === null}
              onClick={() => setFilterDomain(null)}
            />
            {domains.map((d) => (
              <FilterPill
                key={d}
                label={d}
                active={filterDomain === d}
                onClick={() => setFilterDomain(d)}
              />
            ))}
            <div
              style={{
                width: 1,
                height: 16,
                background: 'var(--border-md)',
                margin: '0 4px',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                fontFamily: jakarta,
              }}
            >
              {filteredClips.length} produit{filteredClips.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 12,
              marginTop: 20,
              flex: 1,
              alignContent: 'start',
            }}
          >
            {filteredClips.map((clip) => (
              <ProductCard
                key={clip.id}
                clip={clip}
                isInCompareList={selected.has(clip.id)}
                compareDisabled={selected.size >= 5 && !selected.has(clip.id)}
                onAnalyze={() => openChatWithClips([clip.id])}
                onToggleCompare={() => toggleSelect(clip.id)}
                onDelete={(e) => handleDeleteClip(clip.id, e)}
              />
            ))}
          </div>

          {selected.size > 0 && (
            <CompareBar
              count={selected.size}
              onClear={() => setSelected(new Set())}
              onAskAi={() => openChatWithClips(Array.from(selected))}
            />
          )}
        </>
      )}
    </div>
  )
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 11,
        borderRadius: 20,
        padding: '5px 12px',
        cursor: 'pointer',
        fontFamily: jakarta,
        fontWeight: 500,
        border: active ? '0.5px solid transparent' : '0.5px solid var(--border-md)',
        background: active ? 'var(--accent-light)' : 'var(--bg-card)',
        color: active ? 'var(--tag-text)' : 'var(--text-secondary)',
        transition: 'background .15s, color .15s, border-color .15s',
      }}
    >
      {label}
    </button>
  )
}

function formatClipDayMonth(dateStr: string) {
  const d = new Date(dateStr)
  const day = d.getDate().toString().padStart(2, '0')
  const month = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
  return `${day} ${month}`
}

function starRow(rating: number | null) {
  if (rating == null) return null
  const r = Math.min(5, Math.max(0, Math.round(rating)))
  const filled = '★'.repeat(r)
  const empty = '☆'.repeat(5 - r)
  return filled + empty
}

function ProductCard({
  clip,
  isInCompareList,
  compareDisabled,
  onAnalyze,
  onToggleCompare,
  onDelete,
}: {
  clip: Clip
  isInCompareList: boolean
  compareDisabled: boolean
  onAnalyze: () => void
  onToggleCompare: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const { theme } = useTheme()
  const [deleteHover, setDeleteHover] = useState(false)
  const deleteBg =
    theme === 'dark' ? 'rgba(36, 26, 20, 0.85)' : 'rgba(255,255,255,.75)'
  const deleteBgHover =
    theme === 'dark' ? 'rgba(192, 112, 112, 0.2)' : 'rgba(192,112,112,.15)'
  const trashStroke =
    deleteHover
      ? theme === 'dark'
        ? '#e8a0a0'
        : '#C07070'
      : theme === 'dark'
        ? 'rgba(240, 224, 204, 0.55)'
        : 'rgba(42,30,24,.5)'

  const price =
    clip.price != null
      ? new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: clip.currency || 'EUR',
        }).format(clip.price)
      : null
  const stars = starRow(clip.rating)
  const initial = clip.product_name.trim().charAt(0).toUpperCase() || '?'
  const brandOrSource =
    clip.brand && clip.brand.trim()
      ? clip.brand
      : clip.source_domain

  return (
    <article
      className="group/card"
      style={{
        background: 'var(--bg-card)',
        borderRadius: 14,
        border: '0.5px solid var(--border-md)',
        overflow: 'hidden',
        cursor: 'default',
        transition: 'box-shadow .15s',
        boxShadow: 'none',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(42,30,24,.08)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <button
        type="button"
        title="Supprimer"
        onClick={onDelete}
        className="opacity-0 group-hover/card:opacity-100"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 2,
          width: 24,
          height: 24,
          borderRadius: 7,
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'opacity .15s, background .15s',
          background: deleteHover ? deleteBgHover : deleteBg,
        }}
        onMouseEnter={() => setDeleteHover(true)}
        onMouseLeave={() => setDeleteHover(false)}
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
          <path
            stroke={trashStroke}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            style={{ transition: 'stroke .15s' }}
          />
        </svg>
      </button>

      <div
        style={{
          height: 130,
          background: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {clip.image_url ? (
          <img
            src={clip.image_url}
            alt=""
            referrerPolicy="no-referrer"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              padding: 10,
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: fraunces,
              fontWeight: 300,
              fontStyle: 'italic',
              fontSize: 36,
              color: 'var(--text-muted)',
            }}
          >
            {initial}
          </span>
        )}
      </div>

      <div style={{ padding: '11px 13px 13px' }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1.4,
            marginBottom: 2,
            fontFamily: jakarta,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {clip.product_name}
        </p>
        <p
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            marginBottom: 6,
            fontFamily: jakarta,
          }}
        >
          {brandOrSource}
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            marginBottom: 6,
            flexWrap: 'wrap',
          }}
        >
          {price && (
            <span
              style={{
                fontFamily: playfair,
                fontSize: 16,
                color: 'var(--text-primary)',
              }}
            >
              {price}
            </span>
          )}
          {stars && (
            <span
              style={{
                color: 'var(--accent)',
                fontSize: 10,
                letterSpacing: '0.5px',
                fontFamily: jakarta,
              }}
              title={clip.rating != null ? `${clip.rating}/5` : undefined}
            >
              {stars}
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 6,
            marginTop: 8,
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onAnalyze()
            }}
            style={{
              flex: 1,
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 20,
              padding: '7px 0',
              fontSize: 10,
              fontWeight: 500,
              textAlign: 'center',
              cursor: 'pointer',
              fontFamily: jakarta,
              border: 'none',
            }}
          >
            Analyser
          </button>
          <button
            type="button"
            disabled={compareDisabled && !isInCompareList}
            onClick={(e) => {
              e.stopPropagation()
              onToggleCompare()
            }}
            style={{
              flex: 1,
              background: isInCompareList ? 'var(--accent-light)' : 'var(--bg-secondary)',
              color: isInCompareList ? 'var(--tag-text)' : 'var(--text-secondary)',
              borderRadius: 20,
              padding: '7px 0',
              fontSize: 10,
              fontWeight: 500,
              textAlign: 'center',
              cursor:
                compareDisabled && !isInCompareList ? 'not-allowed' : 'pointer',
              fontFamily: jakarta,
              border: 'none',
              opacity: compareDisabled && !isInCompareList ? 0.4 : 1,
            }}
          >
            {isInCompareList ? '✓ Ajouté' : '+ Sélectionner'}
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
          <span
            style={{
              fontSize: 9,
              color: 'var(--text-muted)',
              fontFamily: jakarta,
            }}
          >
            {clip.source_domain}
          </span>
          <span
            style={{
              fontSize: 9,
              color: 'var(--text-muted)',
              fontFamily: jakarta,
            }}
          >
            {formatClipDayMonth(clip.created_at)}
          </span>
        </div>
      </div>
    </article>
  )
}

function CompareBar({
  count,
  onClear,
  onAskAi,
}: {
  count: number
  onClear: () => void
  onAskAi: () => void
}) {
  const { theme } = useTheme()
  // En clair, --text-primary est le brun foncé ; en sombre il devient clair — garder une barre foncée.
  const barBg =
    theme === 'dark' ? 'var(--bg-sidebar)' : 'var(--text-primary)'

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        width: '100%',
        marginTop: 24,
        background: barBg,
        borderRadius: '10px 10px 0 0',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        zIndex: 5,
        fontFamily: jakarta,
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,.7)' }}>
        <span style={{ color: '#fff', fontWeight: 500 }}>{count}</span>
        {' '}produit{count !== 1 ? 's' : ''} sélectionné{count !== 1 ? 's' : ''}
      </p>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onClear}
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,.6)',
            background: 'rgba(255,255,255,.1)',
            borderRadius: 20,
            padding: '6px 14px',
            border: 'none',
            cursor: 'pointer',
            fontFamily: jakarta,
          }}
        >
          Effacer
        </button>
        <button
          type="button"
          onClick={onAskAi}
          style={{
            fontSize: 11,
            color: '#fff',
            background: 'var(--accent)',
            borderRadius: 20,
            padding: '6px 14px',
            border: 'none',
            cursor: 'pointer',
            fontFamily: jakarta,
            fontWeight: 500,
          }}
        >
          Ouvrir le chat →
        </button>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: '60px 0',
        textAlign: 'center',
        fontFamily: jakarta,
      }}
    >
      <span style={{ fontSize: 40, lineHeight: 1 }}>📎</span>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-primary)',
        }}
      >
        Aucun produit sauvegardé.
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: 'var(--text-muted)',
          maxWidth: 340,
          lineHeight: 1.45,
        }}
      >
        Naviguez sur une page produit et utilisez l&apos;extension sumear pour sauvegarder vos premiers produits.
      </p>
    </div>
  )
}
