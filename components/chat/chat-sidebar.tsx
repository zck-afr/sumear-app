'use client'

// ============================================================================
// ChatSidebar — left pane on /chat. Lists the user's chat sessions grouped
// by recency (Today / Yesterday / Previous 7 days / Older) and exposes
// a "New chat" button.
//
// Sessions of all types (`conversational`, `clip_based`, `project_brief`)
// are shown so users see a unified history. A small icon indicates the
// session type — non-conversational sessions are read-only when opened
// (handled in ChatThread).
// ============================================================================

import { Plus, Trash2, MessageCircle, ShoppingBag, Sparkles } from 'lucide-react'
import { useConfirm } from '@/lib/hooks/use-confirm'

export type SessionType = 'conversational' | 'clip_based' | 'project_brief'

export type SessionSummary = {
  id: string
  title: string
  session_type: SessionType
  updated_at: string
}

const SIDEBAR_WIDTH = 240

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
}: {
  sessions: SessionSummary[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onNewChat: () => void
  onDeleteSession: (id: string) => void
}) {
  const grouped = groupByPeriod(sessions)

  return (
    <aside
      style={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        borderRight: '1px solid var(--ds-border-12)',
        background: 'var(--ds-bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        fontFamily: 'var(--font-plus-jakarta-sans), sans-serif',
      }}
    >
      {/* New chat button */}
      <div style={{ padding: '14px 12px 8px' }}>
        <button
          onClick={onNewChat}
          style={{
            width: '100%',
            padding: '9px 12px',
            background: 'var(--ds-bg-card)',
            color: 'var(--ds-text-primary)',
            border: '0.5px solid var(--ds-border-12)',
            borderRadius: 9,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'inherit',
            transition: 'background 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--ds-bg-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--ds-bg-card)'
          }}
        >
          <Plus size={15} strokeWidth={1.8} />
          <span>New chat</span>
        </button>
      </div>

      {/* Sessions list */}
      <div className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 16px' }}>
        {sessions.length === 0 ? (
          <div
            style={{
              padding: '40px 14px',
              fontSize: 12,
              color: 'var(--ds-text-muted)',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            No conversations yet.
          </div>
        ) : (
          grouped.map(({ label, items }) =>
            items.length === 0 ? null : (
              <div key={label} style={{ marginTop: 12 }}>
                <div
                  style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    color: 'var(--ds-text-muted)',
                    padding: '4px 10px 4px',
                    fontWeight: 500,
                  }}
                >
                  {label}
                </div>
                {items.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    active={s.id === activeSessionId}
                    onClick={() => onSelectSession(s.id)}
                    onDelete={() => onDeleteSession(s.id)}
                  />
                ))}
              </div>
            )
          )
        )}
      </div>
    </aside>
  )
}

function SessionRow({
  session,
  active,
  onClick,
  onDelete,
}: {
  session: SessionSummary
  active: boolean
  onClick: () => void
  onDelete: () => void
}) {
  const Icon = iconForType(session.session_type)
  const { confirmModal, showConfirm } = useConfirm()

  return (
    <>
    {confirmModal}
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        padding: '7px 30px 7px 10px',
        margin: '1px 0',
        borderRadius: 7,
        cursor: 'pointer',
        fontSize: 13,
        color: active ? 'var(--ds-text-primary)' : 'var(--ds-text-secondary)',
        background: active ? 'var(--ds-bg-card)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'background 120ms, color 120ms',
        fontWeight: active ? 500 : 400,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--ds-bg-hover)'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      <Icon
        size={13}
        strokeWidth={1.8}
        style={{ flexShrink: 0, color: 'var(--ds-text-muted)' }}
      />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {session.title || 'Untitled'}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          showConfirm({
            title: 'Delete conversation',
            message: 'This conversation will be permanently deleted.',
            confirmLabel: 'Delete',
            variant: 'danger',
            onConfirm: onDelete,
          })
        }}
        title="Delete chat"
        aria-label="Delete chat"
        style={{
          position: 'absolute',
          right: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          color: 'var(--ds-text-muted)',
          cursor: 'pointer',
          padding: 4,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          opacity: 0.7,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1'
          e.currentTarget.style.color = 'var(--ds-danger)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.7'
          e.currentTarget.style.color = 'var(--ds-text-muted)'
        }}
      >
        <Trash2 size={13} strokeWidth={1.6} />
      </button>
    </div>
    </>
  )
}

function iconForType(type: SessionType) {
  if (type === 'conversational') return MessageCircle
  if (type === 'project_brief') return Sparkles
  return ShoppingBag // clip_based
}

function groupByPeriod(sessions: SessionSummary[]) {
  const today: SessionSummary[] = []
  const yesterday: SessionSummary[] = []
  const lastWeek: SessionSummary[] = []
  const older: SessionSummary[] = []

  // Day-of-year boundary so a chat at 23:59 yesterday lands in "Yesterday"
  // rather than "Today" (would happen with a flat 24h cutoff).
  const nowDate = new Date()
  const todayKey = ymdKey(nowDate)
  const yesterdayKey = ymdKey(new Date(nowDate.getTime() - 86400_000))
  const sevenDaysAgoMs = nowDate.getTime() - 7 * 86400_000

  for (const s of sessions) {
    const t = new Date(s.updated_at)
    const tKey = ymdKey(t)
    if (tKey === todayKey) today.push(s)
    else if (tKey === yesterdayKey) yesterday.push(s)
    else if (t.getTime() >= sevenDaysAgoMs) lastWeek.push(s)
    else older.push(s)
  }

  return [
    { label: 'Today', items: today },
    { label: 'Yesterday', items: yesterday },
    { label: 'Previous 7 days', items: lastWeek },
    { label: 'Older', items: older },
  ]
}

function ymdKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
