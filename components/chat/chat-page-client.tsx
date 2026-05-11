'use client'

// ============================================================================
// ChatPageClient — top-level shell for /chat.
// Holds sidebar state (sessions list + active session) and renders the
// thread on the right. Lives inside ChatLayoutShell's <main> which is
// already a flex container with flex: 1 and minHeight: 0; this component
// just needs to fill it with height: 100%.
// ============================================================================

import { useState, useEffect, useCallback } from 'react'
import { UpgradeModal } from '@/components/billing/upgrade-modal'
import { ChatSidebar, type SessionSummary } from './chat-sidebar'
import { ChatThread } from './chat-thread'

export function ChatPageClient({ isFree, userId }: { isFree: boolean; userId: string }) {
  // Used only for the rate-limit/quota debugging surface — kept to mirror the
  // server prop; not consumed by the UI but useful when extending later.
  void userId

  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(isFree)

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/sessions', { credentials: 'same-origin' })
      if (!res.ok) return
      const data = await res.json()
      // The shared endpoint returns rich entries; we project to SessionSummary
      // and tolerate missing session_type (clip_based default for legacy rows).
      const list: SessionSummary[] = Array.isArray(data.sessions)
        ? data.sessions.map((s: Record<string, unknown>) => ({
            id: String(s.id),
            title: typeof s.title === 'string' ? s.title : 'Untitled',
            session_type:
              s.session_type === 'conversational' ||
              s.session_type === 'clip_based' ||
              s.session_type === 'project_brief'
                ? s.session_type
                : 'clip_based',
            updated_at: typeof s.updated_at === 'string' ? s.updated_at : new Date().toISOString(),
          }))
        : []
      setSessions(list)
    } catch (err) {
      console.error('[chat] loadSessions:', (err as Error).message)
    }
  }, [])

  useEffect(() => {
    if (isFree) return // Don't fetch sessions for Free users — they can't chat anyway.
    loadSessions()
  }, [loadSessions, isFree])

  const handleNewChat = () => {
    setActiveSessionId(null)
  }

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id)
  }

  const handleDeleteSession = async (id: string) => {
    // Optimistic remove: if the API rejects, we re-fetch the canonical list.
    const prev = sessions
    setSessions((s) => s.filter((x) => x.id !== id))
    if (activeSessionId === id) setActiveSessionId(null)

    try {
      const res = await fetch(`/api/chat/sessions/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        setSessions(prev)
        return
      }
    } catch {
      setSessions(prev)
    }
  }

  const handleSessionCreated = (newId: string) => {
    setActiveSessionId(newId)
    loadSessions()
  }

  const handleSessionTouched = () => {
    // Title may have been auto-generated post-stream; refresh.
    loadSessions()
  }

  // ── Free plan: read-only shell with persistent upgrade modal ───────────
  if (isFree) {
    return (
      <>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            flex: 1,
            height: '100%',
            background: 'var(--ds-bg-page)',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 24px' }}>
            <div
              style={{
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: 28,
                color: 'var(--ds-text-primary)',
                marginBottom: 12,
              }}
            >
              Conversational chat is Complete-only
            </div>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--ds-text-secondary)',
                marginBottom: 20,
              }}
            >
              Free-form shopping advice with web search requires the Complete plan.
              Upgrade to ask anything about products, brands, or comparisons.
            </p>
            <button
              onClick={() => setUpgradeOpen(true)}
              style={{
                background: 'var(--ds-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 9,
                padding: '10px 18px',
                fontSize: 14,
                fontWeight: 500,
                fontFamily: 'var(--font-plus-jakarta-sans), sans-serif',
                cursor: 'pointer',
              }}
            >
              See plans
            </button>
          </div>
        </div>
        <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      </>
    )
  }

  // ── Complete plan: full chat shell ─────────────────────────────────────
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: 0,
        background: 'var(--ds-bg-page)',
        overflow: 'hidden',
      }}
    >
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
      />
      <ChatThread
        sessionId={activeSessionId}
        onSessionCreated={handleSessionCreated}
        onMessageSent={handleSessionTouched}
      />
    </div>
  )
}
