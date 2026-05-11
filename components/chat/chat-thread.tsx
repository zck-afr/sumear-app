'use client'

// ============================================================================
// ChatThread — main pane on /chat. Shows the messages of the active session
// and the composer. Streams assistant replies from /api/chat/conversational
// over SSE. Sessions of type clip_based / project_brief are rendered
// read-only (no input) since their UX flows live elsewhere.
//
// SSE shape (matches /api/chat/conversational):
//   data: { chunk: string }
//   data: { done: true, session_id: string }
//   data: { error: string }
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Paperclip, X, Search, Square } from 'lucide-react'
import { AttachClipsModal, type AttachableClip } from './attach-clips-modal'
import type { SessionType } from './chat-sidebar'
import { useStreamingMessage } from '@/lib/chat/use-streaming-message'

type Message = {
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
  errored?: boolean
}

const MAX_INPUT_LEN = 4000
const MAX_ATTACHED = 10

const SUGGESTIONS: string[] = []

export function ChatThread({
  sessionId,
  onSessionCreated,
  onMessageSent,
}: {
  sessionId: string | null
  onSessionCreated: (newId: string) => void
  onMessageSent: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [attachedClips, setAttachedClips] = useState<AttachableClip[]>([])
  const [input, setInput] = useState('')
  const [showAttachModal, setShowAttachModal] = useState(false)
  const [sessionType, setSessionType] = useState<SessionType>('conversational')
  const [loadingSession, setLoadingSession] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const shouldAutoScrollRef = useRef(true)
  /**
   * When the first message creates a new session, we call onSessionCreated()
   * which propagates the new sessionId back down as a prop. Without this guard
   * the session-load effect would immediately re-fetch from the API and
   * overwrite the in-memory messages we just built from the stream.
   * We mark the ID here before calling onSessionCreated so we can skip the
   * API fetch when the effect fires for that ID.
   */
  const justCreatedSessionRef = useRef<string | null>(null)

  const { isStreaming: hookStreaming, send: streamSend, abort: streamAbort, reset: streamReset } = useStreamingMessage()

  // ── Load messages whenever sessionId changes ───────────────────────────
  useEffect(() => {
    // Reset to a fresh thread
    if (!sessionId) {
      setMessages([])
      setAttachedClips([])
      setSessionType('conversational')
      setLoadingSession(false)
      shouldAutoScrollRef.current = true
      return
    }

    // Session was just created by this component — messages are already
    // correct in state; skip the API round-trip.
    if (justCreatedSessionRef.current === sessionId) {
      justCreatedSessionRef.current = null
      return
    }

    let cancelled = false
    setLoadingSession(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/chat/sessions/${sessionId}`, {
          credentials: 'same-origin',
        })
        if (cancelled) return
        if (!res.ok) {
          setMessages([])
          setAttachedClips([])
          setLoadingSession(false)
          return
        }
        const data = await res.json()
        if (cancelled) return

        const rawMessages: Array<{ role: string; content: string }> = Array.isArray(data.messages)
          ? data.messages
          : []
        setMessages(
          rawMessages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        )

        // The session detail returns `clips` (rich) — project to AttachableClip.
        const rawClips: Array<Record<string, unknown>> = Array.isArray(data.clips) ? data.clips : []
        setAttachedClips(
          rawClips
            .filter((c) => typeof c.id === 'string')
            .map((c) => ({
              id: String(c.id),
              product_name: typeof c.product_name === 'string' ? c.product_name : 'Untitled',
              brand: typeof c.brand === 'string' ? c.brand : null,
              image_url: typeof c.image_url === 'string' ? c.image_url : null,
              source_domain: typeof c.source_domain === 'string' ? c.source_domain : null,
            }))
        )

        const t = data.session?.session_type
        setSessionType(
          t === 'conversational' || t === 'clip_based' || t === 'project_brief'
            ? t
            : 'clip_based'
        )
        setLoadingSession(false)
        shouldAutoScrollRef.current = true
      } catch (err) {
        if (!cancelled) {
          console.error('[chat] session fetch:', (err as Error).message)
          setLoadingSession(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sessionId])

  // ── Auto-scroll on new content (smart: pauses when user scrolls up) ────
  useEffect(() => {
    if (!shouldAutoScrollRef.current) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    shouldAutoScrollRef.current = dist <= 80
  }

  // Cancel any in-flight stream when the active session changes or on unmount.
  useEffect(() => {
    streamReset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const autoResizeTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [])

  // ── Send ──────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const message = input.trim().slice(0, MAX_INPUT_LEN)
    if (!message || hookStreaming) return
    if (sessionType !== 'conversational' && sessionId) return // Read-only safety net.

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: message },
      { role: 'assistant', content: '', pending: true },
    ])
    shouldAutoScrollRef.current = true

    await streamSend({
      url: '/api/chat/conversational',
      body: {
        session_id: sessionId,
        message,
        attached_clip_ids: attachedClips.map((c) => c.id).slice(0, MAX_ATTACHED),
      },
      onChunk: (_delta, total) => {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, content: total, pending: true }
          }
          return next
        })
      },
      onDone: (fullContent, newSessionId) => {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, content: fullContent, pending: false }
              : m
          )
        )
        if (!sessionId && newSessionId) {
          // Mark before propagating so the session-load effect skips
          // the unnecessary API fetch for this newly-created session.
          justCreatedSessionRef.current = newSessionId
          onSessionCreated(newSessionId)
        }
        onMessageSent()
      },
      onError: (errMsg) => {
        replaceLastAssistant(`Error: ${errMsg}`, true)
      },
    })
  }

  function replaceLastAssistant(content: string, errored: boolean) {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === prev.length - 1
          ? { ...m, content, pending: false, errored }
          : m
      )
    )
  }

  // ── Stop ──────────────────────────────────────────────────────────────
  const handleStop = () => {
    streamAbort()
    setMessages((prev) => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (last && last.role === 'assistant') {
        const trimmed = last.content?.trimEnd() ?? ''
        next[next.length - 1] = {
          ...last,
          content: trimmed ? `${trimmed} ⏹` : '(stopped before any response)',
          pending: false,
        }
      }
      return next
    })
  }

  // Esc stops the current stream (same behaviour as the Stop button).
  // handleStop reads messages via a functional updater (always fresh) so
  // the eslint-disable is intentional and safe.
  useEffect(() => {
    if (!hookStreaming) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      handleStop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hookStreaming])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleRemoveClip = (id: string) => {
    setAttachedClips((prev) => prev.filter((c) => c.id !== id))
  }

  const isReadOnly = sessionType !== 'conversational' && !!sessionId
  const showWelcome = !sessionId && messages.length === 0

  const composerProps = {
    input,
    setInput: (v: string) => {
      setInput(v.slice(0, MAX_INPUT_LEN))
      autoResizeTextarea()
    },
    textareaRef,
    isStreaming: hookStreaming,
    attachedClips,
    onRemoveClip: handleRemoveClip,
    onAttachClick: () => setShowAttachModal(true),
    onKeyDown: handleKeyDown,
    onSend: handleSend,
    onStop: handleStop,
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 0,
        background: 'var(--ds-bg-page)',
        fontFamily: 'var(--font-plus-jakarta-sans), sans-serif',
      }}
    >
      {/* Read-only banner for non-conversational sessions */}
      {isReadOnly && (
        <div
          style={{
            padding: '10px 24px',
            background: 'var(--ds-bg-hover)',
            borderBottom: '0.5px solid var(--ds-border-07)',
            fontSize: 12,
            color: 'var(--ds-text-secondary)',
            textAlign: 'center',
          }}
        >
          {sessionType === 'clip_based'
            ? 'Read-only — this conversation was started from a product page. Continue it from the History tab.'
            : 'Read-only — project brief generated from a project. Open the project to regenerate.'}
        </div>
      )}

      {showWelcome && !isReadOnly ? (
        /* ── Welcome state: input centred vertically like ChatGPT ── */
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 24px 60px',
          }}
        >
          <div style={{ width: '100%', maxWidth: 680 }}>
            {/* Title */}
            <div
              style={{
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: 30,
                color: 'var(--ds-text-primary)',
                fontWeight: 400,
                textAlign: 'center',
                marginBottom: 28,
              }}
            >
              How can I help you shop today?
            </div>

            {/* Input — centred */}
            <Composer {...composerProps} welcome />

            {/* Suggestion chips — below the input */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                justifyContent: 'center',
                marginTop: 16,
              }}
            >
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s)
                    requestAnimationFrame(() => textareaRef.current?.focus())
                  }}
                  style={{
                    padding: '7px 14px',
                    background: 'var(--ds-bg-card)',
                    border: '0.5px solid var(--ds-border-12)',
                    borderRadius: 999,
                    fontSize: 13,
                    color: 'var(--ds-text-secondary)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'background 150ms, color 150ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--ds-bg-hover)'
                    e.currentTarget.style.color = 'var(--ds-text-primary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--ds-bg-card)'
                    e.currentTarget.style.color = 'var(--ds-text-secondary)'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── Active chat: scrollable messages + bottom composer ── */
        <>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="scrollbar-hide"
            style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}
          >
            <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
              {loadingSession ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '60px 0',
                    color: 'var(--ds-text-muted)',
                    fontSize: 13,
                  }}
                >
                  Loading conversation…
                </div>
              ) : (
                messages.map((m, idx) => <MessageBubble key={idx} message={m} />)
              )}
            </div>
          </div>

          {!isReadOnly && <Composer {...composerProps} />}
        </>
      )}

      <AttachClipsModal
        open={showAttachModal}
        onClose={() => setShowAttachModal(false)}
        currentlyAttachedIds={attachedClips.map((c) => c.id)}
        onAttach={(clips) => {
          setAttachedClips((prev) => {
            const merged = [...prev]
            for (const c of clips) {
              if (merged.length >= MAX_ATTACHED) break
              if (!merged.find((m) => m.id === c.id)) merged.push(c)
            }
            return merged
          })
          setShowAttachModal(false)
        }}
      />
    </div>
  )
}

// ── Message bubble ─────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 2,
          background: isUser ? 'rgba(184,113,90,.15)' : 'var(--ds-accent)',
          border: isUser ? '0.5px solid rgba(184,113,90,.3)' : 'none',
          fontSize: isUser ? 11 : 10,
          fontWeight: isUser ? 600 : 400,
          fontFamily: isUser
            ? 'var(--font-plus-jakarta-sans), sans-serif'
            : 'var(--font-playfair-display), Georgia, serif',
          color: isUser ? 'var(--ds-accent)' : '#fff',
        }}
      >
        {isUser ? 'U' : 'S'}
      </div>

      {/* Bubble */}
      <div
        style={{
          maxWidth: '80%',
          padding: '10px 14px',
          borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
          background: isUser ? 'var(--ds-accent)' : 'var(--ds-bg-card)',
          color: isUser ? '#fff' : 'var(--ds-text-primary)',
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          border: isUser ? 'none' : '0.5px solid var(--ds-border-07)',
        }}
      >
        {message.content || (message.pending ? <PendingDots /> : '')}
      </div>
    </div>
  )
}

function PendingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </span>
  )
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      style={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: 'var(--ds-text-muted)',
        animation: 'sumear-chat-dot 1.2s infinite ease-in-out',
        animationDelay: `${delay}ms`,
      }}
    />
  )
}

// ── Composer ───────────────────────────────────────────────────────────────

function Composer({
  input,
  setInput,
  textareaRef,
  isStreaming,
  attachedClips,
  onRemoveClip,
  onAttachClick,
  onKeyDown,
  onSend,
  onStop,
  welcome = false,
}: {
  input: string
  setInput: (v: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  isStreaming: boolean
  attachedClips: AttachableClip[]
  onRemoveClip: (id: string) => void
  onAttachClick: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  onStop: () => void
  welcome?: boolean
}) {
  const canSend = input.trim().length > 0 && !isStreaming

  return (
    <div
      style={{
        borderTop: welcome ? 'none' : '0.5px solid var(--ds-border-07)',
        padding: welcome ? '0' : '14px 24px 16px',
        background: 'var(--ds-bg-page)',
      }}
    >
      <div style={{ maxWidth: welcome ? '100%' : 760, margin: '0 auto' }}>
        {/* Web-search hint chip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
            fontSize: 11,
            color: 'var(--ds-text-muted)',
            justifyContent: 'flex-end',
          }}
        >
          <Search size={11} strokeWidth={1.8} />
          <span>Web search automatic</span>
        </div>

        {/* Attached clips strip */}
        {attachedClips.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              marginBottom: 10,
            }}
          >
            {attachedClips.map((clip) => (
              <div
                key={clip.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 6px 4px 4px',
                  background: 'var(--ds-bg-card)',
                  border: '0.5px solid var(--ds-border-12)',
                  borderRadius: 7,
                  fontSize: 12,
                  maxWidth: 220,
                  color: 'var(--ds-text-secondary)',
                }}
              >
                {clip.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={clip.image_url}
                    alt=""
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 3,
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 3,
                      background: 'var(--ds-bg-hover)',
                      flexShrink: 0,
                    }}
                  />
                )}
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {clip.product_name}
                </span>
                <button
                  onClick={() => onRemoveClip(clip.id)}
                  aria-label="Remove"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    color: 'var(--ds-text-muted)',
                  }}
                >
                  <X size={12} strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'flex-end',
            background: 'var(--ds-bg-card)',
            border: '0.5px solid var(--ds-border-12)',
            borderRadius: 12,
            padding: 6,
          }}
        >
          <button
            onClick={onAttachClick}
            disabled={isStreaming}
            aria-label="Attach products"
            title="Attach products"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: isStreaming ? 'default' : 'pointer',
              padding: 8,
              borderRadius: 6,
              color: 'var(--ds-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              opacity: isStreaming ? 0.4 : 1,
              flexShrink: 0,
            }}
          >
            <Paperclip size={16} strokeWidth={1.7} />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about a product, brand, or compare options…"
            rows={1}
            maxLength={MAX_INPUT_LEN}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              padding: '8px 6px',
              fontSize: 14,
              fontFamily: 'inherit',
              color: 'var(--ds-text-primary)',
              minHeight: 24,
              maxHeight: 200,
              overflowY: 'auto',
              lineHeight: 1.5,
            }}
            className="scrollbar-hide"
          />

          {isStreaming ? (
            <button
              onClick={onStop}
              aria-label="Stop generating"
              title="Stop generating (Esc)"
              style={{
                background: 'var(--ds-bg-hover)',
                color: 'var(--ds-text-secondary)',
                border: '0.5px solid var(--ds-border-12)',
                borderRadius: 8,
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                transition: 'background 150ms',
              }}
            >
              <Square size={14} fill="currentColor" strokeWidth={0} />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!input.trim()}
              aria-label="Send"
              style={{
                background: input.trim() ? 'var(--ds-accent)' : 'var(--ds-bg-hover)',
                color: input.trim() ? '#fff' : 'var(--ds-text-muted)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 12px',
                cursor: input.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                transition: 'background 150ms',
              }}
            >
              <Send size={15} strokeWidth={1.8} />
            </button>
          )}
        </div>

        {/* Sub-hint */}
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: 'var(--ds-text-muted)',
            textAlign: 'center',
          }}
        >
          Sumear can make mistakes — verify important details on the merchant&rsquo;s site.
        </div>
      </div>

      {/* Local keyframes for the pending dots */}
      <style jsx global>{`
        @keyframes sumear-chat-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </div>
  )
}
