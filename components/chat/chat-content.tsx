'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Square } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams, useRouter } from 'next/navigation'
import { SumearWordmark } from '@/components/ui/sumear-wordmark'
import { SumearLogoBadge } from '@/components/ui/sumear-logo-badge'
import { UpgradeModal } from '@/components/billing/upgrade-modal'
import { useTheme } from '@/components/theme-provider'
import { useStreamingMessage } from '@/lib/chat/use-streaming-message'

/** Proxied image URL for the embed (bypasses CORS / 403). */
function proxyImageUrl(url: string | null): string | null {
  if (!url || !url.startsWith('http')) return url
  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

export interface Clip {
  id: string
  product_name: string
  brand: string | null
  price: number | null
  currency: string
  image_url: string | null
  source_domain: string
  rating?: number | null
  review_count?: number | null
}

const MAX_MESSAGE_LENGTH = 500
interface Message { role: 'user' | 'assistant'; content: string; isLimit?: boolean }

const SUGGESTIONS_SINGLE = [
  'Is it worth the price?',
  'What are the main flaws?',
  'Are there cheaper alternatives?',
  'Is it durable?',
]
const SUGGESTIONS_MULTI = [
  'Which one do you recommend?',
  'Best value for money?',
  'What are the key differences?',
  'Which one is the most sturdy?',
]

export function ChatContent({
  embedAccessToken = null,
  isEmbed = false,
  initialClips,
  onClose,
  topbarLabel,
  noZoom = false,
  projectPanel = false,
}: {
  embedAccessToken?: string | null
  isEmbed?: boolean
  initialClips?: Clip[]
  onClose?: () => void
  topbarLabel?: string
  noZoom?: boolean
  /** Slim right-side panel variant used on the project detail page. */
  projectPanel?: boolean
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const clipIdsParam = searchParams.get('clips')
  const sessionIdParam = searchParams.get('session_id')
  const { theme } = useTheme()

  const [allClips, setAllClips] = useState<Clip[]>([])
  const [selectedClips, setSelectedClips] = useState<Clip[]>(initialClips ?? [])
  const [messages, setMessages] = useState<Message[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionIdParam)
  const [userName, setUserName] = useState<string>('')
  const [input, setInput] = useState('')
  const [clipsLoading, setClipsLoading] = useState(initialClips ? false : true)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [upgradeDescription, setUpgradeDescription] = useState<string | undefined>(undefined)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Ref on the currently-mounted messages scroll container. Only one of the
  // three layout variants (embed / dashboard / projectPanel) is ever rendered
  // at a time, so a single ref is enough — React reassigns it on mount.
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // When true, new AI tokens auto-scroll the view to the latest line. We
  // disable it as soon as the user scrolls away from the bottom so they can
  // read earlier parts of a reply while it's still streaming, and re-enable
  // it the moment they scroll back near the end of the thread.
  const shouldAutoScrollRef = useRef(true)
  const fetchRetryCount = useRef(0)
  const maxFetchRetries = 3

  const {
    isStreaming: hookStreaming,
    streamingContent,
    send: streamSend,
    abort: streamAbort,
    reset: streamReset,
  } = useStreamingMessage()

  useEffect(() => {
    setCurrentSessionId(sessionIdParam)
  }, [sessionIdParam])

  // Cancel any in-flight stream when the session changes (e.g. user navigates
  // to a different chat or the embed clip set changes).
  useEffect(() => {
    streamReset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdParam])

  useEffect(() => {
    if (initialClips) return
    if (clipIdsParam) {
      const ids = clipIdsParam.split(',').filter(Boolean)
      if (ids.length > 0 && selectedClips.length === 0) {
        setSelectedClips(ids.map(id => ({
          id,
          product_name: 'Loading…',
          brand: null,
          price: null,
          currency: 'EUR',
          image_url: null,
          source_domain: '',
          rating: null,
          review_count: null,
        })) as Clip[])
      }
    }
  }, [clipIdsParam])

  useEffect(() => {
    if (initialClips) return
    if (isEmbed && !embedAccessToken) return

    // Cancellation guard:
    // - In dev, React StrictMode mounts the component twice → this effect runs
    //   twice and we'd otherwise fire `/api/clips?ids=…` twice.
    // - In prod, the same dep changing value (e.g. embedAccessToken arriving
    //   after a refresh) could race two in-flight fetches; the late one
    //   would clobber the first.
    // A single `cancelled` flag handled by the cleanup neutralizes both.
    let cancelled = false
    const abortController = new AbortController()

    async function fetchClips() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      const token = embedAccessToken ?? (await supabase.auth.getSession()).data.session?.access_token
      if (cancelled) return

      let resolvedUser = user
      if (!resolvedUser && token) {
        try {
          const { data: { user: jwtUser } } = await (supabase.auth as any).getUser(token)
          resolvedUser = jwtUser
        } catch { /* ignore */ }
      }
      if (cancelled) return

      if (resolvedUser) {
        const meta = (resolvedUser.user_metadata ?? {}) as Record<string, any>
        const name = meta.full_name || meta.name || (resolvedUser.email ? resolvedUser.email.split('@')[0] : '') || ''
        setUserName(String(name))
      }

      if (!resolvedUser && !token) {
        if (clipIdsParam && fetchRetryCount.current < maxFetchRetries) {
          fetchRetryCount.current += 1
          setTimeout(() => { if (!cancelled) fetchClips() }, 400)
          return
        }
        setClipsLoading(false)
        return
      }

      if (resolvedUser) {
        const { data: all } = await supabase
          .from('clips')
          .select('id, product_name, brand, price, currency, image_url, source_domain, rating, review_count')
          .eq('user_id', resolvedUser.id)
          .order('created_at', { ascending: false })
          .limit(20)
        if (cancelled) return
        if (all) setAllClips(all)
      }

      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      try {
        if (sessionIdParam) {
          const res = await fetch(`/api/chat/sessions/${sessionIdParam}`, { headers, credentials: 'same-origin', signal: abortController.signal })
          if (cancelled) return
          if (res.ok) {
            const data = await res.json()
            if (cancelled) return
            if (data.messages?.length) setMessages(data.messages)
            if (data.clips?.length) setSelectedClips(data.clips)
            setCurrentSessionId(data.session?.id ?? sessionIdParam)
          }
        } else if (clipIdsParam) {
          const ids = clipIdsParam.split(',').filter(Boolean)
          if (ids.length > 0) {
            const res = await fetch(`/api/clips?ids=${encodeURIComponent(ids.join(','))}`, { headers, credentials: 'same-origin', signal: abortController.signal })
            if (cancelled) return
            if (res.ok) {
              const data = await res.json()
              if (cancelled) return
              if (data.clips?.length) setSelectedClips(data.clips)
            } else if (res.status === 401 && typeof window !== 'undefined' && window.parent) {
              window.parent.postMessage({ type: 'sumear-request-auth' }, '*')
            }
            if (!res.ok && resolvedUser) {
              const { data } = await supabase
                .from('clips')
                .select('id, product_name, brand, price, currency, image_url, source_domain, rating, review_count')
                .in('id', ids)
              if (cancelled) return
              if (data?.length) setSelectedClips(data)
            }
          }
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError') return
        throw err
      }

      if (cancelled) return
      setClipsLoading(false)
    }
    fetchClips()

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [clipIdsParam, sessionIdParam, embedAccessToken, isEmbed])

  // Update `shouldAutoScrollRef` whenever the user manually scrolls the
  // thread. A 60px threshold tolerates tiny rubber-band/momentum offsets so
  // we don't mistakenly pause auto-scroll while the view is essentially
  // pinned to the bottom.
  const handleMessagesScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    shouldAutoScrollRef.current = distanceFromBottom <= 60
  }

  useEffect(() => {
    const last = messages[messages.length - 1]
    // A newly posted user message always wins: jump back to the bottom so the
    // user sees what they just sent, and re-arm auto-scroll for the upcoming
    // AI reply.
    if (last?.role === 'user') {
      shouldAutoScrollRef.current = true
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    // Only follow the streaming cursor if the user hasn't scrolled up to
    // re-read earlier content. Otherwise let them stay wherever they are.
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [streamingContent])

  // Auto-resize textarea — runs synchronously before paint to avoid any
  // flicker (useLayoutEffect vs useEffect). Honors `min-height` / `max-height`
  // set inline on the textarea so each layout (embed popup, dashboard) can
  // define its own range. Skipped for the projectPanel layout which uses
  // native CSS `field-sizing: content` to avoid any JS-driven layout glitches.
  useLayoutEffect(() => {
    if (projectPanel) return
    const el = textareaRef.current
    if (!el) return
    const minH = parseInt(el.style.minHeight || '', 10) || 44
    const maxH = parseInt(el.style.maxHeight || '', 10) || 160
    el.style.height = `${minH}px`
    const scrollH = el.scrollHeight
    const newHeight = Math.min(Math.max(scrollH, minH), maxH)
    el.style.height = newHeight + 'px'
    el.style.overflowY = scrollH > maxH ? 'auto' : 'hidden'
  }, [input, projectPanel])

  function removeClip(id: string) {
    setSelectedClips(prev => prev.filter(c => c.id !== id))
  }

  // ── Stop ──────────────────────────────────────────────────────────────────
  // capture streamingContent BEFORE abort clears it, then persist it as a
  // regular message so the user doesn't lose what was already displayed.
  const handleStop = () => {
    const partialContent = streamingContent
    streamAbort()
    if (partialContent) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `${partialContent.trimEnd()} ⏹` },
      ])
    }
  }

  // Ref always points to the latest handleStop so the Esc key effect always
  // captures the current streamingContent even though it only re-runs when
  // hookStreaming changes.
  const handleStopRef = useRef(handleStop)
  handleStopRef.current = handleStop

  useEffect(() => {
    if (!hookStreaming) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      handleStopRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hookStreaming])

  async function handleSend() {
    const text = input.trim()
    if (!text || hookStreaming || selectedClips.length === 0) return
    if (text.length > MAX_MESSAGE_LENGTH) return

    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')

    // Capture auth token (needed in embed/projectPanel where Bearer is required).
    let token = embedAccessToken
    if (!token) {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      token = session?.access_token ?? null
    }
    const extraHeaders: Record<string, string> = {}
    if (token) extraHeaders['Authorization'] = `Bearer ${token}`

    // Snapshot of messages before the user message was pushed (history for the API).
    const historySnapshot = messages

    await streamSend({
      url: '/api/chat',
      headers: extraHeaders,
      body: {
        clip_ids: selectedClips.map(c => c.id),
        message: text,
        history: historySnapshot,
        session_id: currentSessionId ?? undefined,
      },
      onDone: (fullContent, doneSessionId) => {
        setMessages(prev => [...prev, { role: 'assistant', content: fullContent }])
        if (doneSessionId && !currentSessionId) {
          setCurrentSessionId(doneSessionId)
          const url = new URL(window.location.href)
          url.searchParams.set('session_id', doneSessionId)
          window.history.replaceState({}, '', url.pathname + '?' + url.searchParams.toString())
        }
      },
      onError: (errMsg, code) => {
        const isLimit = code === 'DAILY_LIMIT' || code === 'QUOTA_EXCEEDED'
        if (code === 'QUOTA_EXCEEDED') {
          setUpgradeDescription(errMsg)
          setUpgradeOpen(true)
        }
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: errMsg || 'Error.', isLimit },
        ])
      },
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() }
  }

  function handleClose() {
    if (onClose) {
      onClose()
    } else if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: 'sumear-close' }, '*')
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (clipsLoading) {
    return isEmbed
      ? (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ds-bg-page)' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--ds-bg-image)', borderTopColor: 'var(--ds-accent)' }} className="animate-spin" />
        </div>
      )
      : (
        <div className="flex items-center justify-center h-[42vh]">
          <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--ds-bg-image)', borderTopColor: 'var(--ds-accent)' }} className="animate-spin" />
        </div>
      )
  }

  const isLoadingPlaceholder = (name: string) => name === 'Loading…'
  const charCount = input.length
  const charNearLimit = charCount > 450
  const charOverLimit = charCount > MAX_MESSAGE_LENGTH
  const inputPlaceholder = selectedClips.length === 0
    ? 'Select products first...'
    : selectedClips.length === 1
    ? 'Ask a question about this product...'
    : 'Ask a question about these products...'

  const suggestions = selectedClips.length <= 1 ? SUGGESTIONS_SINGLE : SUGGESTIONS_MULTI
  const userInitial = userName ? userName[0].toUpperCase() : 'U'

  // ── Derived insight chips from product metadata ────────────────────────────
  const insightChips: { dot: string; label: string; value: string }[] = []
  const primaryClip = selectedClips[0] ?? null
  if (primaryClip && !isLoadingPlaceholder(primaryClip.product_name)) {
    if (primaryClip.price != null) {
      insightChips.push({
        dot: 'var(--ds-green)',
        label: 'Price',
        value: new Intl.NumberFormat('en-US', { style: 'currency', currency: primaryClip.currency || 'EUR' }).format(primaryClip.price),
      })
    }
    if (primaryClip.rating != null) {
      insightChips.push({
        dot: primaryClip.rating >= 4
          ? 'var(--ds-green)'
          : primaryClip.rating >= 3
          ? 'var(--ds-text-muted)'
          : 'var(--ds-danger)',
        label: 'Rating',
        value: `${primaryClip.rating.toFixed(1)}/5`,
      })
    }
    if (primaryClip.review_count != null && primaryClip.review_count > 0) {
      insightChips.push({ dot: 'var(--ds-text-muted)', label: 'Reviews', value: primaryClip.review_count.toLocaleString('en-US') })
    }
  }

  // ── Shared input row (textarea + send button) ─────────────────────────────
  const inputRow = (
    <div style={{ padding: '8px 20px 0', flexShrink: 0 }}>
      <div style={{
        display: 'flex',
        gap: 10,
        background: 'var(--ds-bg-card)',
        border: '0.5px solid var(--ds-border-12)',
        borderRadius: 28,
        padding: '10px 10px 10px 18px',
        boxShadow: '0 2px 10px rgba(0,0,0,.04)',
        alignItems: 'center',
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={inputPlaceholder}
          disabled={selectedClips.length === 0}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={1}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: 13,
            color: 'var(--ds-text-primary)',
            fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
            background: 'transparent',
            resize: 'none',
            lineHeight: 1.5,
            minHeight: 44,
            maxHeight: 160,
            overflowY: 'hidden',
          }}
          className="chat-textarea scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none]"
        />
        {hookStreaming ? (
          <button
            onClick={handleStop}
            aria-label="Stop generating"
            title="Stop generating (Esc)"
            style={{
              width: 32, height: 32,
              borderRadius: '50%',
              background: 'var(--ds-bg-hover)',
              border: '0.5px solid var(--ds-border-12)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: 'var(--ds-text-secondary)',
              transition: 'background 0.12s',
            }}
          >
            <Square size={12} fill="currentColor" strokeWidth={0} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim() || selectedClips.length === 0 || charOverLimit}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--ds-accent)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              opacity: (!input.trim() || selectedClips.length === 0 || charOverLimit) ? 0.45 : 1,
              transition: 'opacity 0.12s',
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )

  // ── Disclaimer + char counter ──────────────────────────────────────────────
  const disclaimer = (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px 24px 14px', flexShrink: 0 }}>
      <p style={{ fontSize: 9, color: 'var(--ds-text-muted)' }}>
        Sumear can make mistakes. Check important information.
      </p>
      {charCount > 0 && (
        <span style={{ fontSize: 10, color: charOverLimit || charNearLimit ? 'var(--ds-danger)' : 'var(--ds-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {charCount}/{MAX_MESSAGE_LENGTH}
        </span>
      )}
    </div>
  )

  // ── Combined (used in non-embed layout) ────────────────────────────────────
  const inputBar = (
    <div style={{ flexShrink: 0 }}>
      {inputRow}
      {disclaimer}
    </div>
  )

  // ── Project detail panel layout (slim right-side dashboard panel) ────────
  if (projectPanel) {
    const projectName = topbarLabel ?? 'Project'
    const n = selectedClips.length

    // Theme-aware styling for the branded header only.
    const isDark = theme === 'dark'
    const header = {
      background: isDark
        ? 'linear-gradient(135deg, rgba(184,113,90,.12) 0%, var(--bg-card) 60%)'
        : 'linear-gradient(135deg, rgba(184,113,90,.1) 0%, var(--bg-card) 60%)',
      border: isDark
        ? '0.5px solid rgba(184,113,90,.2)'
        : '0.5px solid rgba(184,113,90,.22)',
      badgeBg: isDark ? 'rgba(184,113,90,.2)' : 'rgba(184,113,90,.12)',
      badgeBorder: isDark ? '0.5px solid rgba(184,113,90,.3)' : '0.5px solid rgba(184,113,90,.25)',
      lineColor: isDark ? '#C8A882' : '#B8715A',
      dotColor: isDark ? '#7AB87A' : '#6A9E6A',
      dotShadow: isDark ? '0 0 0 3px rgba(122,184,122,.2)' : '0 0 0 3px rgba(106,158,106,.2)',
      closeBg: isDark ? 'rgba(255,255,255,.07)' : 'rgba(42,30,24,.07)',
      closeColor: isDark ? 'var(--text-muted)' : 'var(--text-secondary)',
    }

    const frPlaceholder = selectedClips.length === 0
      ? 'Sélectionne des produits…'
      : selectedClips.length === 1
      ? 'Pose une question sur ce produit…'
      : 'Pose une question sur ces produits…'

    return (
      <>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        background: 'var(--bg-page)',
        fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
      }}>
        {/* Header — branded, theme-aware */}
        <div style={{
          flexShrink: 0,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          background: header.background,
          borderBottom: header.border,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {/* Icon badge */}
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              flexShrink: 0,
              background: header.badgeBg,
              border: header.badgeBorder,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="14" height="12" viewBox="0 0 32 26" fill="none" aria-hidden>
                <rect x="1" y="1" width="18" height="3" rx="1.5" fill={header.lineColor} />
                <rect x="1" y="7.5" width="30" height="3" rx="1.5" fill={header.lineColor} opacity=".6" />
                <rect x="1" y="14" width="23" height="3" rx="1.5" fill={header.lineColor} opacity=".6" />
                <rect x="1" y="20.5" width="13" height="3" rx="1.5" fill={header.lineColor} opacity=".3" />
              </svg>
            </div>

            {/* Text block */}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  Sumear
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: header.dotColor,
                    boxShadow: header.dotShadow,
                    flexShrink: 0,
                  }}
                />
              </div>
              <p style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                margin: '2px 0 0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {projectName} · {n} produit{n !== 1 ? 's' : ''} analysé{n !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            style={{
              fontSize: 10,
              color: header.closeColor,
              background: header.closeBg,
              padding: '4px 12px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              flexShrink: 0,
            }}
          >
            Fermer ✕
          </button>
        </div>

        {/* Messages area — ONLY scrollable zone */}
        <div
          ref={scrollContainerRef}
          onScroll={handleMessagesScroll}
          className="scrollbar-hide"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {messages.length === 0 && !hookStreaming ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              textAlign: 'center',
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--accent-light)',
                border: '0.5px solid rgba(184,113,90,.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px',
              }}>
                <svg width="14" height="12" viewBox="0 0 32 26" fill="none" aria-hidden>
                  <rect x="1" y="1" width="18" height="3" rx="1.5" fill="var(--accent)" />
                  <rect x="1" y="7.5" width="30" height="3" rx="1.5" fill="var(--accent)" opacity=".6" />
                  <rect x="1" y="14" width="23" height="3" rx="1.5" fill="var(--accent)" opacity=".6" />
                  <rect x="1" y="20.5" width="13" height="3" rx="1.5" fill="var(--accent)" opacity=".3" />
                </svg>
              </div>
              <p style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                marginBottom: 5,
                margin: '0 0 5px',
              }}>
                Comment puis-je aider ?
              </p>
              <p style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                maxWidth: 200,
                margin: '0 auto',
              }}>
                J&apos;ai analysé tes {n} produit{n !== 1 ? 's' : ''} pour{' '}
                <span style={{ color: 'var(--accent)' }}>{projectName}</span>.
              </p>
            </div>
          ) : (
            <>
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user'
            return (
              <div key={i} style={{
                display: 'flex',
                gap: 8,
                flexDirection: isUser ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 24, height: 24,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                  background: isUser ? 'var(--accent-light)' : 'var(--accent)',
                  color: isUser ? 'var(--tag-text)' : 'white',
                  fontSize: 9,
                  fontWeight: isUser ? 500 : 400,
                  fontFamily: isUser ? "'Plus Jakarta Sans', sans-serif" : "'Playfair Display', Georgia, serif",
                }}>
                  {isUser ? userInitial : 'S'}
                </div>
                <div style={{
                  maxWidth: '78%',
                  background: msg.isLimit ? 'var(--ds-danger-bg)' : isUser ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: msg.isLimit ? 'var(--ds-danger)' : isUser ? 'white' : 'var(--text-primary)',
                  border: isUser ? 'none' : msg.isLimit ? '0.5px solid var(--ds-danger-border)' : 'none',
                  borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                  padding: '9px 13px',
                  fontSize: 11,
                  lineHeight: 1.7,
                }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                </div>
              </div>
            )
          })}

          {hookStreaming && !streamingContent && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 2,
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 9, color: 'white',
              }}>S</div>
              <div style={{
                background: 'var(--bg-secondary)',
                borderRadius: '4px 12px 12px 12px',
                padding: '9px 13px',
              }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 150, 300].map(delay => (
                    <div key={delay} className="animate-bounce" style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: 'var(--text-muted)',
                      animationDelay: `${delay}ms`,
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {hookStreaming && streamingContent && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 2,
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 9, color: 'white',
              }}>S</div>
              <div style={{
                background: 'var(--bg-secondary)',
                borderRadius: '4px 12px 12px 12px',
                padding: '9px 13px',
                fontSize: 11, lineHeight: 1.7,
                color: 'var(--text-primary)',
                maxWidth: '80%',
              }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {streamingContent}
                  <span className="animate-pulse" style={{
                    display: 'inline-block', width: 2, height: '1em',
                    background: 'var(--accent)', marginLeft: 2,
                    verticalAlign: 'text-bottom', borderRadius: 1,
                  }} />
                </div>
              </div>
            </div>
          )}
            </>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion chips (hidden once conversation started) */}
        {messages.length === 0 && !hookStreaming && selectedClips.length > 0 && (
          <div style={{
            flexShrink: 0,
            padding: '0 14px 8px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            justifyContent: 'center',
          }}>
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => setInput(s)}
                style={{
                  fontSize: 10,
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  border: '0.5px solid var(--border-md)',
                  padding: '4px 10px',
                  borderRadius: 20,
                  cursor: 'pointer',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  transition: 'background 0.12s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div style={{ flexShrink: 0, padding: '6px 10px 10px' }}>
          <div style={{
            display: 'flex',
            gap: 6,
            alignItems: 'flex-end',
            background: 'var(--bg-secondary)',
            border: '0.5px solid var(--border-md)',
            borderRadius: 16,
            padding: '8px 8px 8px 14px',
            boxSizing: 'border-box',
          }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={frPlaceholder}
              disabled={selectedClips.length === 0}
              maxLength={MAX_MESSAGE_LENGTH}
              rows={2}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: 11,
                color: 'var(--text-primary)',
                fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
                background: 'transparent',
                resize: 'none',
                lineHeight: 1.5,
                minHeight: 36,
                maxHeight: 120,
                padding: 0,
                boxSizing: 'border-box',
                display: 'block',
                fieldSizing: 'content',
              } as React.CSSProperties}
              className="chat-textarea scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none]"
            />
            {hookStreaming ? (
              <button
                onClick={handleStop}
                aria-label="Stop generating"
                title="Stop generating (Esc)"
                style={{
                  width: 24, height: 24,
                  borderRadius: '50%',
                  background: 'var(--bg-secondary)',
                  border: '0.5px solid var(--border-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: 'var(--text-secondary)',
                  transition: 'background 0.12s',
                }}
              >
                <Square size={10} fill="currentColor" strokeWidth={0} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || selectedClips.length === 0 || charOverLimit}
                style={{
                  width: 24, height: 24,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  opacity: (!input.trim() || selectedClips.length === 0 || charOverLimit) ? 0.45 : 1,
                  transition: 'opacity 0.12s',
                }}
              >
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            )}
          </div>
          <p style={{
            fontSize: 9,
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: 2,
            marginBottom: 0,
          }}>
            Sumear peut faire des erreurs.
          </p>
        </div>
      </div>
      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        description={upgradeDescription}
        embedTopRedirect={isEmbed}
      />
      </>
    )
  }

  // ── Embed layout ───────────────────────────────────────────────────────────
  if (isEmbed) {
    const derivedLabel = selectedClips.length === 1
      ? (isLoadingPlaceholder(selectedClips[0].product_name) ? 'Loading…' : selectedClips[0].product_name)
      : selectedClips.length > 1
      ? `${selectedClips.length} products`
      : 'Product chat'
    const contextLabel = topbarLabel ?? derivedLabel

    return (
      <>
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--ds-bg-page)',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
        fontSize: 14,
        ...(noZoom ? {} : { zoom: 1.5 }),
      }}>

        {/* ── Topbar ── */}
        <div style={{
          height: 42,
          minHeight: 42,
          background: 'var(--ds-chat-topbar)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
        }}>
          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <SumearLogoBadge size={16} />
            <SumearWordmark size={13} darkBg style={{ flexShrink: 0 }} />
            <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,.15)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {contextLabel}
            </span>
          </div>
          {/* Close */}
          <button
            onClick={handleClose}
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,.5)',
              background: 'rgba(255,255,255,.08)',
              borderRadius: 20,
              padding: '4px 12px',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              marginLeft: 12,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              whiteSpace: 'nowrap',
            }}
          >
            Close ✕
          </button>
        </div>

        {/* ── Chat body ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {/* Messages zone — only scrollable area */}
          <div
            ref={scrollContainerRef}
            onScroll={handleMessagesScroll}
            className="scrollbar-hide"
            style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            {/* Product cards */}
            {selectedClips.map(clip => {
              const isPlaceholder = isLoadingPlaceholder(clip.product_name)
              const priceStr = clip.price != null
                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: clip.currency || 'EUR' }).format(clip.price)
                : null
              const ratingRounded = clip.rating != null ? Math.round(clip.rating) : null
              const starsStr = ratingRounded != null
                ? '★'.repeat(ratingRounded) + '☆'.repeat(5 - ratingRounded)
                : null

              return (
                <div key={clip.id} style={{
                  background: 'var(--ds-bg-card)',
                  border: '0.5px solid var(--ds-border-10)',
                  borderRadius: 14,
                  padding: '12px 14px',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  flexShrink: 0,
                }}>
                  {/* Thumbnail */}
                  <div style={{
                    width: 54,
                    height: 54,
                    borderRadius: 10,
                    background: 'var(--ds-bg-image)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {clip.image_url && !isPlaceholder ? (
                      <img
                        src={proxyImageUrl(clip.image_url) ?? clip.image_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span style={{ fontSize: 20 }}>{isPlaceholder ? '⋯' : '📦'}</span>
                    )}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--ds-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {isPlaceholder ? 'Loading…' : clip.product_name}
                    </p>
                    {priceStr && (
                      <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 15, color: 'var(--ds-accent)', marginTop: 2 }}>
                        {priceStr}
                      </p>
                    )}
                    {(starsStr || (clip.review_count != null && clip.review_count > 0)) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                        {starsStr && <span style={{ color: 'var(--ds-accent)', fontSize: 10 }}>{starsStr}</span>}
                        {clip.review_count != null && clip.review_count > 0 && (
                          <span style={{ fontSize: 10, color: 'var(--ds-text-muted)' }}>{clip.review_count.toLocaleString('en-US')} reviews</span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Remove */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeClip(clip.id) }}
                    style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ds-text-muted)', padding: 4, display: 'flex', alignItems: 'center' }}
                    aria-label="Remove"
                  >
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}

            {/* Insight chips */}
            {insightChips.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {insightChips.map((chip, i) => (
                  <div key={i} style={{
                    background: 'var(--ds-bg-card)',
                    border: '0.5px solid var(--ds-border-10)',
                    borderRadius: 20,
                    padding: '5px 10px',
                    fontSize: 11,
                    color: 'var(--ds-text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: chip.dot, flexShrink: 0 }} />
                    {chip.label} <strong>{chip.value}</strong>
                  </div>
                ))}
              </div>
            )}

            {/* Conversation messages */}
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user'
              return (
                <div key={i} style={{ display: 'flex', gap: 9, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                  {/* Avatar */}
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                    background: isUser ? 'var(--ds-bg-tag)' : 'var(--ds-accent)',
                    color: isUser ? 'var(--ds-text-tag)' : 'white',
                    fontSize: isUser ? 10 : 9,
                    fontWeight: isUser ? 500 : 400,
                    fontFamily: isUser ? "'Plus Jakarta Sans', sans-serif" : "'Playfair Display', Georgia, serif",
                  }}>
                    {isUser ? userInitial : 'S'}
                  </div>
                  {/* Bubble */}
                  <div style={{
                    maxWidth: '78%',
                    background: msg.isLimit ? 'var(--ds-danger-bg)' : isUser ? 'var(--ds-accent)' : 'var(--ds-bg-card)',
                    color: msg.isLimit ? 'var(--ds-danger)' : isUser ? 'white' : 'var(--ds-text-primary)',
                    border: isUser ? 'none' : msg.isLimit ? '0.5px solid var(--ds-danger-border)' : '0.5px solid var(--ds-border-10)',
                    borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                    padding: '10px 14px',
                    fontSize: 12,
                    lineHeight: 1.7,
                  }}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  </div>
                </div>
              )
            })}

            {/* Loading dots (waiting for first token) */}
            {hookStreaming && !streamingContent && (
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', background: 'var(--ds-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 2,
                  fontFamily: "'Playfair Display', Georgia, serif", fontSize: 9, color: 'white',
                }}>S</div>
                <div style={{ background: 'var(--ds-bg-card)', border: '0.5px solid var(--ds-border-10)', borderRadius: '4px 14px 14px 14px', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 150, 300].map(delay => (
                      <div key={delay} className="animate-bounce" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ds-text-muted)', animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Streaming message bubble */}
            {hookStreaming && streamingContent && (
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', background: 'var(--ds-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 2,
                  fontFamily: "'Playfair Display', Georgia, serif", fontSize: 9, color: 'white',
                }}>S</div>
                <div style={{ background: 'var(--ds-bg-card)', border: '0.5px solid var(--ds-border-10)', borderRadius: '4px 14px 14px 14px', padding: '10px 14px', fontSize: 12, lineHeight: 1.7, color: 'var(--ds-text-primary)', maxWidth: '80%' }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {streamingContent}
                    <span className="animate-pulse" style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--ds-accent)', marginLeft: 2, verticalAlign: 'text-bottom', borderRadius: 1 }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion chips — hidden once the conversation has started so
              starter prompts stop competing with the live thread. */}
          {messages.length === 0 && !hookStreaming && (
          <div
            className="scrollbar-hide"
            style={{ padding: '4px 28px 10px', overflowX: 'auto', flexShrink: 0 }}
          >
            <div style={{ display: 'flex', gap: 7, flexWrap: 'nowrap' }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setInput(s)}
                  style={{
                    background: 'var(--ds-bg-card)',
                    border: '0.5px solid var(--ds-border-12)',
                    borderRadius: 20,
                    padding: '6px 13px',
                    fontSize: 11,
                    color: 'var(--ds-text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--ds-bg-card)')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Input bar — elevated 10% from bottom */}
          <div style={{ flexShrink: 0, paddingBottom: '10%' }}>
            {inputRow}
          </div>
          {/* Disclaimer — pinned at very bottom */}
          {disclaimer}
        </div>
      </div>
      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        description={upgradeDescription}
        embedTopRedirect={isEmbed}
      />
    </>
    )
  }

  // ── Dashboard (non-embed) layout ───────────────────────────────────────────
  // Insights computed from selected clips (shown when 2+ products)
  const validClips = selectedClips.filter(c => !isLoadingPlaceholder(c.product_name))
  const pricedClips = validClips.filter(c => typeof c.price === 'number' && !Number.isNaN(c.price))
  const ratedClips = validClips.filter(c => typeof c.rating === 'number' && !Number.isNaN(c.rating as number))
  const reviewedClips = validClips.filter(c => typeof c.review_count === 'number' && (c.review_count as number) > 0)

  const priceRange: { min: Clip; max: Clip } | null = pricedClips.length >= 2
    ? pricedClips.reduce<{ min: Clip; max: Clip }>((acc, c) => ({
        min: (c.price as number) < (acc.min.price as number) ? c : acc.min,
        max: (c.price as number) > (acc.max.price as number) ? c : acc.max,
      }), { min: pricedClips[0], max: pricedClips[0] })
    : null

  const bestRated = ratedClips.length > 0
    ? ratedClips.reduce((a, b) => ((a.rating as number) >= (b.rating as number) ? a : b))
    : null

  const leastReviewed = reviewedClips.length > 0
    ? reviewedClips.reduce((a, b) => ((a.review_count as number) <= (b.review_count as number) ? a : b))
    : null

  const multiInsights: { dot: string; label: string }[] = []
  if (selectedClips.length >= 2) {
    if (priceRange) {
      const fmt = (c: Clip) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c.currency || 'EUR', maximumFractionDigits: 0 }).format(c.price as number)
      multiInsights.push({ dot: 'var(--accent)', label: `Price range ${fmt(priceRange.min)} – ${fmt(priceRange.max)}` })
    }
    if (bestRated) {
      multiInsights.push({ dot: '#7AB87A', label: `Best rated: ${bestRated.product_name}` })
    }
    if (leastReviewed) {
      multiInsights.push({ dot: '#C07070', label: `Least reviews: ${leastReviewed.product_name}` })
    }
  }

  const totalProductsLabel = `${selectedClips.length} product${selectedClips.length !== 1 ? 's' : ''} selected`

  const sumearLinesSvg = (size: { w: number; h: number }, color: string = 'var(--accent)') => (
    <svg width={size.w} height={size.h} viewBox="0 0 32 26" fill="none" aria-hidden>
      <rect x="1" y="1" width="18" height="3" rx="1.5" fill={color} />
      <rect x="1" y="7.5" width="30" height="3" rx="1.5" fill={color} opacity=".6" />
      <rect x="1" y="14" width="23" height="3" rx="1.5" fill={color} opacity=".6" />
      <rect x="1" y="20.5" width="13" height="3" rx="1.5" fill={color} opacity=".3" />
    </svg>
  )

  const handleRemoveProduct = (id: string) => {
    const next = selectedClips.filter(c => c.id !== id)
    if (next.length === 0) {
      router.push('/clips')
      return
    }
    removeClip(id)
  }

  const showWelcome = messages.length === 0 && !hookStreaming

  return (
    <>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: 'calc((100dvh - 130px) / 1.21)',
    }}>
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '80.5%',
      height: '80.5%',
      minHeight: 0,
      background: 'var(--bg-card)',
      fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
      overflow: 'hidden',
      borderRadius: 14,
      border: '0.5px solid var(--border)',
      transform: 'translateY(-10%)',
    }}>

      {/* ── 1. TOPBAR ── */}
      <div style={{
        height: 44,
        minHeight: 44,
        flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(184,113,90,.12) 0%, var(--bg-secondary) 60%)',
        borderBottom: '0.5px solid rgba(184,113,90,.2)',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'rgba(184,113,90,.2)',
            border: '0.5px solid rgba(184,113,90,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {sumearLinesSvg({ w: 11, h: 10 })}
          </div>
          <span style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 14,
            color: 'var(--text-primary)',
            flexShrink: 0,
          }}>sumear</span>
          <div style={{
            width: 1, height: 12,
            background: theme === 'dark' ? 'rgba(255,255,255,.15)' : 'rgba(42,30,24,.15)',
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            minWidth: 0,
          }}>
            {totalProductsLabel}
          </span>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: '#7AB87A',
            boxShadow: '0 0 0 2px rgba(122,184,122,.2)',
            flexShrink: 0, marginLeft: 2,
          }} />
        </div>
        {/* Right */}
        <button
          onClick={() => router.push('/clips')}
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            background: 'var(--bg-secondary)',
            border: '0.5px solid var(--border)',
            borderRadius: 20,
            padding: '4px 12px',
            cursor: 'pointer',
            flexShrink: 0,
            marginLeft: 12,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            whiteSpace: 'nowrap',
          }}
        >
          ← Back to products
        </button>
      </div>

      {/* ── 2. PRODUCTS STRIP ── */}
      {selectedClips.length > 0 && (
        <div style={{
          flexShrink: 0,
          padding: '12px 20px 10px',
          borderBottom: '0.5px solid var(--border)',
          background: 'var(--bg-secondary)',
        }}>
          <div style={{
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '.6px',
            color: 'var(--text-muted)',
            fontWeight: 500,
            marginBottom: 8,
          }}>
            Selected products
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selectedClips.map(clip => {
              const isPlaceholder = isLoadingPlaceholder(clip.product_name)
              const priceStr = clip.price != null
                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: clip.currency || 'EUR' }).format(clip.price)
                : null
              return (
                <div key={clip.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  flex: '1 1 180px', minWidth: 0,
                  background: 'var(--bg-card)',
                  borderRadius: 10,
                  border: '0.5px solid var(--border-md)',
                  padding: '8px 10px',
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 6,
                    background: 'var(--bg-secondary)',
                    flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {clip.image_url && !isPlaceholder ? (
                      <img src={clip.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} referrerPolicy="no-referrer" />
                    ) : (
                      <span style={{ fontSize: 14 }}>{isPlaceholder ? '⋯' : '📦'}</span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 500, color: 'var(--text-primary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    flex: 1, minWidth: 0,
                  }}>
                    {isPlaceholder ? 'Loading…' : clip.product_name}
                  </span>
                  {priceStr && (
                    <span style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: 10,
                      color: 'var(--accent)',
                      flexShrink: 0,
                    }}>{priceStr}</span>
                  )}
                  <button
                    onClick={() => handleRemoveProduct(clip.id)}
                    aria-label="Remove product"
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      flexShrink: 0,
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >×</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 3. INSIGHTS ROW ── */}
      {multiInsights.length > 0 && (
        <div style={{
          flexShrink: 0,
          padding: '8px 20px',
          borderBottom: '0.5px solid var(--border)',
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
        }}>
          {multiInsights.map((chip, i) => (
            <div key={i} style={{
              background: 'var(--bg-secondary)',
              borderRadius: 20,
              padding: '4px 10px',
              fontSize: 10,
              color: 'var(--text-secondary)',
              border: '0.5px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: chip.dot,
                flexShrink: 0,
              }} />
              <span style={{
                maxWidth: 260,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>{chip.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── 4. MESSAGES / WELCOME ── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleMessagesScroll}
        className="scrollbar-hide"
        style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}
      >
        {showWelcome ? (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            textAlign: 'center',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--accent-light)',
              border: '0.5px solid rgba(184,113,90,.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 10px',
            }}>
              {sumearLinesSvg({ w: 14, h: 12 })}
            </div>
            <p style={{
              fontSize: 13, fontWeight: 500,
              color: 'var(--text-primary)',
              margin: '0 0 5px',
            }}>How can I help?</p>
            <p style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              lineHeight: 1.5,
              maxWidth: 220,
              margin: '0 auto',
            }}>
              I&apos;ve analysed your{' '}
              <span style={{ color: 'var(--accent)' }}>{selectedClips.length}</span>{' '}
              product{selectedClips.length !== 1 ? 's' : ''}. Ask me anything about them.
            </p>
          </div>
        ) : (
          <div style={{
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user'
              return (
                <div key={i} style={{
                  display: 'flex', gap: 8,
                  flexDirection: isUser ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginTop: 2,
                    background: isUser ? 'rgba(184,113,90,.18)' : 'var(--accent)',
                    color: isUser ? 'var(--accent)' : 'white',
                    fontSize: isUser ? 10 : 9,
                    fontWeight: isUser ? 600 : 400,
                    fontFamily: isUser ? "'Plus Jakarta Sans', sans-serif" : "'Playfair Display', Georgia, serif",
                    border: isUser ? '0.5px solid rgba(184,113,90,.3)' : 'none',
                  }}>
                    {isUser ? userInitial : 'S'}
                  </div>
                  <div style={{
                    maxWidth: '78%',
                    background: msg.isLimit ? 'var(--ds-danger-bg)' : isUser ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: msg.isLimit ? 'var(--ds-danger)' : isUser ? 'white' : 'var(--text-primary)',
                    border: msg.isLimit ? '0.5px solid var(--ds-danger-border)' : isUser ? 'none' : '0.5px solid var(--border-md)',
                    borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                    padding: '9px 13px',
                    fontSize: 11,
                    lineHeight: 1.65,
                  }}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  </div>
                </div>
              )
            })}

            {hookStreaming && !streamingContent && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 2,
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 9, color: 'white',
                }}>S</div>
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '0.5px solid var(--border-md)',
                  borderRadius: '4px 12px 12px 12px',
                  padding: '9px 13px',
                }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 150, 300].map(delay => (
                      <div key={delay} className="animate-bounce" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-muted)', animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {hookStreaming && streamingContent && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 2,
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 9, color: 'white',
                }}>S</div>
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '0.5px solid var(--border-md)',
                  borderRadius: '4px 12px 12px 12px',
                  padding: '9px 13px',
                  fontSize: 11, lineHeight: 1.65,
                  color: 'var(--text-primary)',
                  maxWidth: '80%',
                }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {streamingContent}
                    <span className="animate-pulse" style={{
                      display: 'inline-block',
                      width: 2, height: '1em',
                      background: 'var(--accent)',
                      marginLeft: 2,
                      verticalAlign: 'text-bottom',
                      borderRadius: 1,
                    }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── 5. SUGGESTION CHIPS ──
          Only shown before the user has sent anything — once the thread is
          live we hide them so the chat doesn't keep pushing starter prompts
          under every new AI reply. */}
      {messages.length === 0 && !hookStreaming && (
      <div style={{
        padding: '0 20px 8px',
        flexShrink: 0,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        justifyContent: showWelcome ? 'center' : 'flex-start',
      }}>
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => setInput(s)}
            style={{
              fontSize: 10,
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              border: '0.5px solid var(--border-md)',
              padding: '4px 10px',
              borderRadius: 20,
              cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              whiteSpace: 'nowrap',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
          >
            {s}
          </button>
        ))}
      </div>
      )}

      {/* ── 6. INPUT BAR ── */}
      <div style={{ padding: '8px 16px 12px', flexShrink: 0 }}>
        <div style={{
          display: 'flex',
          gap: 8,
          background: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-md)',
          borderRadius: 24,
          padding: '8px 8px 8px 16px',
          alignItems: 'center',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about these products…"
            disabled={selectedClips.length === 0}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={1}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 12,
              color: 'var(--text-primary)',
              fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
              background: 'transparent',
              resize: 'none',
              lineHeight: 1.5,
              minHeight: 24,
              maxHeight: 120,
              overflowY: 'hidden',
            }}
            className="chat-textarea scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none]"
          />
          {hookStreaming ? (
            <button
              onClick={handleStop}
              aria-label="Stop generating"
              title="Stop generating (Esc)"
              style={{
                width: 28, height: 28,
                borderRadius: '50%',
                background: 'var(--bg-secondary)',
                border: '0.5px solid var(--border-md)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--text-secondary)',
                transition: 'background 0.12s',
              }}
            >
              <Square size={11} fill="currentColor" strokeWidth={0} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || selectedClips.length === 0 || charOverLimit}
              style={{
                width: 28, height: 28,
                borderRadius: '50%',
                background: 'var(--accent)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                opacity: (!input.trim() || selectedClips.length === 0 || charOverLimit) ? 0.45 : 1,
                transition: 'opacity 0.12s',
              }}
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          )}
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          marginTop: 5,
        }}>
          <p style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
            Sumear can make mistakes. Check important information.
          </p>
          {charCount > 0 && (
            <span style={{
              fontSize: 9,
              color: charOverLimit || charNearLimit ? 'var(--ds-danger)' : 'var(--text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {charCount}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>
      </div>
    </div>
    </div>
    <UpgradeModal
      open={upgradeOpen}
      onOpenChange={setUpgradeOpen}
      description={upgradeDescription}
      embedTopRedirect={isEmbed}
    />
    </>
  )
}
