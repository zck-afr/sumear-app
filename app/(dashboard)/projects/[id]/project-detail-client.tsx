'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { ChatContent, type Clip } from '@/components/chat/chat-content'
import { SumearWordmark } from '@/components/ui/sumear-wordmark'

const fraunces = "var(--font-fraunces), serif"
const jakarta  = "'Plus Jakarta Sans', sans-serif"
const playfair = "'Playfair Display', Georgia, serif"

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'var(--accent)', color: '#fff',
  borderRadius: 20, padding: '9px 18px',
  fontSize: 12, fontWeight: 500, fontFamily: jakarta,
  border: 'none', cursor: 'pointer', textDecoration: 'none',
  whiteSpace: 'nowrap',
}

const btnSecondary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'var(--bg-card)', color: 'var(--text-secondary)',
  border: '0.5px solid var(--border-md)',
  borderRadius: 20, padding: '9px 18px',
  fontSize: 12, fontWeight: 500, fontFamily: jakarta,
  cursor: 'pointer', textDecoration: 'none',
  whiteSpace: 'nowrap',
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 1 1 12 0c0 4-3 5-3 9H9c0-4-3-5-3-9Z" />
      <path d="M9 18h6" />
      <path d="M10 9a2 2 0 0 1 4 0c0 2-2 2.5-2 4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Dot() {
  return <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-muted)', opacity: 0.5, display: 'inline-block', flexShrink: 0 }} />
}

export interface ProjectData {
  id: string
  name: string
  emoji: string | null
  created_at: string
}

interface Props {
  project: ProjectData
  products: Clip[]
  aiBrief: string
  /** True when the cached brief is stale and should be refreshed in background */
  aiBriefStale?: boolean
  /** SHA-256 fingerprint of current products list */
  productsFingerprint?: string
  createdAt: string
  totalSpent: number
  currency: string
}

export function ProjectDetailClient({ project, products, aiBrief, aiBriefStale, productsFingerprint, createdAt, totalSpent, currency }: Props) {
  const [chatOpen, setChatOpen] = useState(false)
  const [brief, setBrief] = useState(aiBrief)
  const [briefLoading, setBriefLoading] = useState(false)
  const briefFetched = useRef(false)

  useEffect(() => {
    if (!aiBriefStale || briefFetched.current || !productsFingerprint) return
    briefFetched.current = true
    setBriefLoading(true)

    fetch(`/api/projects/${project.id}/brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint: productsFingerprint }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.brief) setBrief(data.brief)
        if (data.debounced && data.retry_after_ms > 0) {
          const timer = setTimeout(() => {
            briefFetched.current = false
            setBriefLoading(true)
            fetch(`/api/projects/${project.id}/brief`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fingerprint: productsFingerprint }),
            })
              .then(r => r.json())
              .then(d => { if (d.brief) setBrief(d.brief) })
              .catch(() => {})
              .finally(() => setBriefLoading(false))
          }, data.retry_after_ms)
          return () => clearTimeout(timer)
        }
      })
      .catch(() => {})
      .finally(() => setBriefLoading(false))
  }, [aiBriefStale, productsFingerprint, project.id])

  const fmtPrice = (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency })

  const topbarLabel = `${project.name}${project.emoji ? ` ${project.emoji}` : ''}`

  return (
    /* outer wrapper: flex row, fills the main content area */
    <div style={{ display: 'flex', height: '100%', minHeight: '100dvh', overflow: 'hidden', position: 'relative' }}>

      {/* ── Left: project content ── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          transition: 'flex 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Non-scrollable header */}
        <div style={{ flexShrink: 0 }}>

          {/* Fil d’Ariane : seule la flèche renvoie à la liste (évite les clics accidentels sur tout le libellé « Projets » → GET /projects) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <Link
              href="/projects"
              aria-label="Retour à la liste des projets"
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                textDecoration: 'none',
                padding: '2px 6px',
                borderRadius: 6,
                border: '0.5px solid transparent',
              }}
              className="hover:border-[var(--border-md)]"
            >
              ←
            </Link>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Projets</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>›</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{project.name}</span>
          </div>

          {/* Title + action buttons */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <span style={{ fontFamily: fraunces, fontSize: 36, fontWeight: 300, fontStyle: 'italic', color: 'var(--text-primary)', letterSpacing: '-.4px', lineHeight: 1 }}>
                Projet,
              </span>
              <br />
              <span style={{ fontFamily: fraunces, fontSize: 22, fontWeight: 300, color: 'var(--accent)', letterSpacing: '-.2px', lineHeight: 1.3 }}>
                {project.emoji ? `${project.emoji} ` : ''}{project.name}
              </span>

              {/* Meta pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <span style={{ fontSize: 10, borderRadius: 20, padding: '3px 10px', background: 'var(--accent-light)', color: 'var(--tag-text)', fontFamily: jakarta }}>
                  {createdAt}
                </span>
                <Dot />
                <span style={{ fontSize: 10, borderRadius: 20, padding: '3px 10px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontFamily: jakarta }}>
                  {products.length} produit{products.length !== 1 ? 's' : ''}
                </span>
                {totalSpent > 0 && (
                  <>
                    <Dot />
                    <span style={{ fontSize: 10, borderRadius: 20, padding: '3px 10px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontFamily: jakarta }}>
                      {fmtPrice(totalSpent)} engagés
                    </span>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexShrink: 0, paddingTop: 4 }}>
              <span style={btnSecondary}>Modifier</span>
              <button style={btnPrimary} onClick={() => setChatOpen(true)}>
                Ouvrir le chat <ArrowIcon />
              </button>
            </div>
          </div>

          {/* Budget bar */}
          {totalSpent > 0 && (
            <div style={{ marginTop: 16, marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: jakarta }}>Budget engagé</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: jakarta }}>{fmtPrice(totalSpent)}</span>
              </div>
              <div style={{ height: 5, background: 'var(--bg-secondary)', borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '100%', background: 'var(--accent)', borderRadius: 20 }} />
              </div>
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* Produits du projet */}
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-secondary)', marginBottom: 12, fontFamily: jakarta }}>
              Produits du projet
            </p>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, border: '0.5px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <EarIcon />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, fontFamily: jakarta }}>
                Pour ajouter un produit, navigue sur une page produit et utilise{' '}
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>l&apos;extension sumear</span>
                {' '}→ Comparer → sélectionne ce projet.
              </p>
            </div>

            {products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 12, fontFamily: jakarta }}>
                Aucun produit dans ce projet pour l&apos;instant.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {products.map(product => (
                  <div key={product.id} style={{ position: 'relative', background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border-md)', overflow: 'hidden' }}>
                    <div style={{ height: 80, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                      {product.image_url
                        ? <img src={product.image_url} alt="" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                        : <span style={{ fontSize: 22 }}>📦</span>
                      }
                    </div>
                    <div style={{ padding: '8px 10px 10px' }}>
                      <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {product.product_name}
                      </p>
                      {product.price != null && (
                        <p style={{ fontSize: 12, fontFamily: playfair, color: 'var(--accent)', margin: '3px 0 0' }}>
                          {fmtPrice(Number(product.price))}
                        </p>
                      )}
                    </div>
                    <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: '#6A9E6A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckIcon />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Brief IA */}
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-secondary)', marginBottom: 12, fontFamily: jakarta }}>
              Brief IA
            </p>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border-md)', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', fontFamily: jakarta }}>Synthèse de ton équipement</span>
              </div>
              {products.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65, margin: 0, fontFamily: jakarta }}>
                  Ajoute des produits à ce projet pour obtenir une synthèse IA.
                </p>
              ) : briefLoading && !brief ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65, margin: 0, fontFamily: jakarta, opacity: 0.7 }}>
                  Génération de la synthèse IA…
                </p>
              ) : brief ? (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0, fontFamily: jakarta, opacity: briefLoading ? 0.6 : 1, transition: 'opacity 0.3s' }}>
                  {brief}
                </p>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65, margin: 0, fontFamily: jakarta }}>
                  La synthèse IA n&apos;a pas pu être générée.
                </p>
              )}
              {products.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <button style={btnPrimary} onClick={() => setChatOpen(true)}>
                    Ouvrir le chat <ArrowIcon />
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Right: chat panel — fixed 400px ── */}
      <div
        style={{
          width: chatOpen ? 400 : 0,
          minWidth: 0,
          overflow: 'hidden',
          transition: 'width 0.25s ease',
          flexShrink: 0,
          borderLeft: chatOpen ? '0.5px solid var(--border-md)' : 'none',
        }}
      >
        {/* font-size reset so rem values inside are not affected by html zoom */}
        <div style={{ width: 400, height: '100%', fontSize: 16, transform: chatOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.25s ease' }}>
          <Suspense>
            <ChatContent
              isEmbed
              noZoom
              initialClips={products}
              topbarLabel={topbarLabel}
              onClose={() => setChatOpen(false)}
            />
          </Suspense>
        </div>
      </div>

    </div>
  )
}
