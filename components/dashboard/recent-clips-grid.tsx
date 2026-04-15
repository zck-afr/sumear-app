'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Clip {
  id: string
  product_name: string
  brand: string | null
  price: number | null
  currency: string
  image_url: string | null
  source_domain: string
  created_at: string
}

export function RecentClipsGrid({ clips }: { clips: Clip[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function toggle(clipId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(clipId)) next.delete(clipId)
      else next.add(clipId)
      return next
    })
  }

  const clipsParam = selectedIds.size > 0 ? Array.from(selectedIds).join(',') : null

  return (
    <div>
      <div className="flex overflow-x-auto scrollbar-hide" style={{ gap: 34, paddingBottom: 4 }}>
        {clips.map((clip) => {
          const formattedPrice =
            clip.price != null
              ? new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: clip.currency || 'EUR',
                }).format(clip.price)
              : null
          const isSelected = selectedIds.has(clip.id)

          return (
            <div
              key={clip.id}
              onClick={() => toggle(clip.id)}
              style={{
                width: 185,
                flexShrink: 0,
                background: 'var(--ds-bg-card)',
                border: `0.5px solid ${isSelected ? 'var(--ds-accent)' : 'var(--ds-border-10)'}`,
                borderRadius: 14,
                overflow: 'hidden',
                cursor: 'pointer',
                outline: isSelected ? '1.5px solid var(--ds-accent)' : 'none',
                outlineOffset: -1,
                transition: 'border-color 0.12s, outline 0.12s',
              }}
            >
              {/* Image area */}
              <div
                className="relative flex items-center justify-center"
                style={{ height: 110, background: 'var(--ds-bg-image)' }}
              >
                {clip.image_url ? (
                  <img
                    src={clip.image_url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 10 }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span style={{ fontSize: 32 }}>📦</span>
                )}
                {isSelected && (
                  <div
                    className="absolute top-[8px] right-[8px] flex items-center justify-center"
                    style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--ds-accent)' }}
                  >
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Info area */}
              <div style={{ padding: '12px 14px' }}>
                <p
                  style={{
                    fontFamily: 'var(--font-plus-jakarta-sans), sans-serif',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--ds-text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {clip.product_name}
                </p>
                {formattedPrice && (
                  <p
                    style={{
                      fontFamily: 'var(--font-playfair-display), Georgia, serif',
                      fontSize: 15,
                      fontWeight: 400,
                      color: 'var(--ds-green)',
                      marginTop: 4,
                    }}
                  >
                    {formattedPrice}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* CTA when products are selected */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3" style={{ marginTop: 14 }}>
          <span style={{ fontSize: 13, color: 'var(--ds-text-secondary)' }}>
            {selectedIds.size} produit{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>
          <Link
            href={`/chat?clips=${clipsParam}`}
            className="flex items-center gap-[7px] transition-opacity hover:opacity-80"
            style={{
              background: 'var(--ds-accent)',
              color: '#fff',
              borderRadius: 12,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Ouvrir le chat
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  )
}
