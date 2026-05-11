'use client'

import { useState, useEffect, useLayoutEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  /** Cache fingerprint (products + user budget) for brief POST */
  briefFingerprint: string
  initialUserBudget: number | null
  createdAt: string
  totalSpent: number
  currency: string
}

/** Chat panel width + gap exposed to the dashboard shell so the top-right
 *  user row can slide left when the chat opens (simulated split-page effect). */
const CHAT_PANEL_WIDTH = 360
const CHAT_PANEL_GAP = 20
const CHAT_OFFSET_TOTAL = CHAT_PANEL_WIDTH + CHAT_PANEL_GAP

export function ProjectDetailClient({ project, products, aiBrief, briefFingerprint, initialUserBudget, createdAt, totalSpent, currency }: Props) {
  const router = useRouter()
  const [chatOpen, setChatOpen] = useState(false)
  const [brief, setBrief] = useState(aiBrief)
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefError, setBriefError] = useState('')
  const [budgetInput, setBudgetInput] = useState(
    initialUserBudget != null ? String(initialUserBudget) : ''
  )
  const [savingBudget, setSavingBudget] = useState(false)

  // Prevent the page from scrolling — this layout fills the viewport exactly.
  // Restored on unmount so other pages remain scrollable.
  useLayoutEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    setBrief(aiBrief)
  }, [aiBrief])

  useEffect(() => {
    setBudgetInput(initialUserBudget != null ? String(initialUserBudget) : '')
  }, [initialUserBudget])

  const fmtPrice = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency })

  const parsedBudget = (() => {
    const t = budgetInput.replace(',', '.').trim()
    if (t === '') return null
    const n = parseFloat(t)
    return Number.isFinite(n) && n >= 0 ? n : null
  })()

  async function saveBudget(): Promise<boolean> {
    const next = parsedBudget
    const same =
      (next === null && initialUserBudget === null) ||
      (next != null && initialUserBudget != null && Math.abs(next - initialUserBudget) < 0.005)
    if (same) return true
    setSavingBudget(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_budget: next }),
      })
      if (!res.ok) return false
      router.refresh()
      return true
    } finally {
      setSavingBudget(false)
    }
  }

  async function generateBrief() {
    if (products.length === 0) return
    setBriefError('')
    setBriefLoading(true)
    try {
      const saved = await saveBudget()
      if (!saved) {
        setBriefError('Could not save your budget. Try again.')
        return
      }

      const post = async (depth = 0): Promise<void> => {
        if (depth > 5) {
          setBriefError('Please wait a moment and try again.')
          return
        }
        const res = await fetch(`/api/projects/${project.id}/brief`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fingerprint: briefFingerprint }),
        })
        const data = await res.json().catch(() => ({}))

        if (res.status === 429 && typeof data.error === 'string') {
          const m = data.error.match(/(\d+)s/)
          const waitMs = m ? parseInt(m[1], 10) * 1000 : 3000
          await new Promise(r => setTimeout(r, waitMs))
          await post(depth + 1)
          return
        }

        if (data.debounced && typeof data.retry_after_ms === 'number' && data.retry_after_ms > 0) {
          await new Promise(r => setTimeout(r, data.retry_after_ms))
          await post(depth + 1)
          return
        }

        if (!res.ok) {
          setBriefError(data.code === 'LLM_FAILED' ? 'Summary could not be generated. Try again.' : (data.error || 'Request failed'))
          return
        }
        if (data.quota_exceeded) {
          setBriefError('Monthly AI limit reached. Upgrade to continue.')
          return
        }
        if (data.brief) setBrief(data.brief)
        router.refresh()
      }

      await post()
    } catch {
      setBriefError('Network error. Try again.')
    } finally {
      setBriefLoading(false)
    }
  }

  const userBudgetNum = initialUserBudget
  const barPct =
    userBudgetNum != null && userBudgetNum > 0
      ? Math.min(100, (totalSpent / userBudgetNum) * 100)
      : 0
  const overBudget = userBudgetNum != null && userBudgetNum > 0 && totalSpent > userBudgetNum

  return (
    /* outer wrapper: fixed viewport height so the page never scrolls.
       Flex row: left column shrinks when chat opens (split-view effect),
       right panel pushes in via width animation.
       Height formula: (100dvh - 133px) / 1.21 — see comment above. */
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      height: 'calc((100dvh - 133px) / 1.21)',
      overflow: 'hidden',
    }}>

      {/* ── Left: project content — flex, scrolls internally ── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          transition: 'flex 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* Non-scrollable header */}
        <div style={{ flexShrink: 0 }}>

          {/* Breadcrumb: only the arrow links back to the list (prevents accidental clicks on the entire "Projects" label → GET /projects) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <Link
              href="/projects"
              aria-label="Back to projects list"
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
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Projects</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>›</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{project.name}</span>
          </div>

          {/* Title + action buttons */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <span style={{ fontFamily: fraunces, fontSize: 36, fontWeight: 300, fontStyle: 'normal', color: 'var(--text-primary)', letterSpacing: '-.4px', lineHeight: 1 }}>
                Project,
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
                  {products.length} product{products.length !== 1 ? 's' : ''}
                </span>
                {totalSpent > 0 && (
                  <>
                    <Dot />
                    <span style={{ fontSize: 10, borderRadius: 20, padding: '3px 10px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontFamily: jakarta }}>
                      {fmtPrice(totalSpent)} total
                    </span>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexShrink: 0, paddingTop: 4 }}>
              <span style={btnSecondary}>Edit</span>
            </div>
          </div>

          {/* Total + optional budget progress + budget input */}
          <div style={{ marginTop: 16, marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: userBudgetNum != null && userBudgetNum > 0 ? 6 : 0 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: jakarta }}>Total</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: jakarta }}>{fmtPrice(totalSpent)}</span>
            </div>
            {userBudgetNum != null && userBudgetNum > 0 && (
              <div style={{ height: 5, background: 'var(--bg-secondary)', borderRadius: 20, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{
                  height: '100%',
                  width: `${barPct}%`,
                  background: overBudget ? '#C07070' : 'var(--accent)',
                  borderRadius: 20,
                  transition: 'width .2s ease',
                }} />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label htmlFor="project-budget" style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: jakarta, flexShrink: 0 }}>
                Your budget ({currency})
              </label>
              <input
                id="project-budget"
                type="text"
                inputMode="decimal"
                value={budgetInput}
                onChange={e => setBudgetInput(e.target.value)}
                onBlur={() => { void saveBudget() }}
                placeholder="e.g. 500"
                disabled={savingBudget}
                style={{
                  width: 120,
                  padding: '6px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: jakarta,
                  border: '1px solid var(--border-md)',
                  background: 'var(--bg-page)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              {savingBudget && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: jakarta }}>Saving…</span>
              )}
            </div>
          </div>
        </div>

        {/* Body (natural flow — page scrolls, not the column) */}
        <div>

          {/* Project products */}
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-secondary)', marginBottom: 12, fontFamily: jakarta }}>
              Project products
            </p>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, border: '0.5px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <EarIcon />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, fontFamily: jakarta }}>
                To add a product, browse a product page and use{' '}
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>the Sumear extension</span>
                {' '}→ Compare → select this project.
              </p>
            </div>

            {products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 12, fontFamily: jakarta }}>
                No products in this project yet.
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
              AI brief
            </p>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border-md)', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', fontFamily: jakarta }}>Summary of your setup</span>
              </div>
              {products.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65, margin: 0, fontFamily: jakarta }}>
                  Add products to this project to get an AI summary.
                </p>
              ) : (
                <>
                  {!brief && !briefLoading && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65, margin: '0 0 12px', fontFamily: jakarta }}>
                      Generate a summary on demand. It uses your product list and your budget (if set).
                    </p>
                  )}
                  {briefLoading && !brief ? (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65, margin: 0, fontFamily: jakarta, opacity: 0.7 }}>
                      Generating AI summary…
                    </p>
                  ) : brief ? (
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0, fontFamily: jakarta, opacity: briefLoading ? 0.6 : 1, transition: 'opacity 0.3s' }}>
                      {brief}
                    </p>
                  ) : !briefLoading ? (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65, margin: 0, fontFamily: jakarta }}>
                      No summary yet.
                    </p>
                  ) : null}
                  {briefError && (
                    <p style={{ fontSize: 11, color: '#C07070', margin: '10px 0 0', fontFamily: jakarta }}>{briefError}</p>
                  )}
                  <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      type="button"
                      style={{
                        ...btnPrimary,
                        opacity: briefLoading || products.length === 0 ? 0.6 : 1,
                        cursor: briefLoading || products.length === 0 ? 'not-allowed' : 'pointer',
                      }}
                      disabled={briefLoading || products.length === 0}
                      onClick={() => { void generateBrief() }}
                    >
                      {brief ? 'Regenerate summary' : 'Generate summary'}
                    </button>
                    <button style={btnPrimary} onClick={() => setChatOpen(true)}>
                      Open chat <ArrowIcon />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Right: chat panel — flex width animation (split-view effect) ── */}
      <div
        style={{
          width: chatOpen ? CHAT_OFFSET_TOTAL : 0,
          minWidth: 0,
          overflow: 'hidden',
          transition: 'width 0.25s ease',
          flexShrink: 0,
          paddingLeft: chatOpen ? CHAT_PANEL_GAP : 0,
          boxSizing: 'border-box',
          display: 'flex',
        }}
      >
        {/* font-size reset so rem values inside are not affected by html zoom */}
        <div style={{
          width: CHAT_PANEL_WIDTH,
          flex: 1,
          fontSize: 16,
          transform: chatOpen ? 'translateX(0)' : `translateX(${CHAT_OFFSET_TOTAL}px)`,
          transition: 'transform 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          border: '0.5px solid var(--border-md)',
          borderRadius: 14,
          overflow: 'hidden',
          background: 'var(--bg-page)',
        }}>
          <Suspense>
            <ChatContent
              projectPanel
              noZoom
              initialClips={products}
              topbarLabel={project.name}
              onClose={() => setChatOpen(false)}
            />
          </Suspense>
        </div>
      </div>

    </div>
  )
}
