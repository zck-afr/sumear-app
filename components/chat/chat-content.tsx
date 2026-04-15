'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { SumearWordmark } from '@/components/ui/sumear-wordmark'
import { SumearLogoBadge } from '@/components/ui/sumear-logo-badge'
import { UpgradeModal } from '@/components/billing/upgrade-modal'

/** URL d'image proxifiée pour l'embed (évite CORS / 403). */
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
  'Est-ce que ça vaut le prix ?',
  'Quels sont les défauts principaux ?',
  'Y a-t-il des alternatives moins chères ?',
  'Est-il durable ?',
]
const SUGGESTIONS_MULTI = [
  'Lequel recommandes-tu ?',
  'Rapport qualité/prix ?',
  'Quelles sont les différences clés ?',
  'Lequel est le plus solide ?',
]

export function ChatContent({
  embedAccessToken = null,
  isEmbed = false,
  initialClips,
  onClose,
  topbarLabel,
  noZoom = false,
}: {
  embedAccessToken?: string | null
  isEmbed?: boolean
  initialClips?: Clip[]
  onClose?: () => void
  topbarLabel?: string
  noZoom?: boolean
}) {
  const searchParams = useSearchParams()
  const clipIdsParam = searchParams.get('clips')
  const sessionIdParam = searchParams.get('session_id')

  const [allClips, setAllClips] = useState<Clip[]>([])
  const [selectedClips, setSelectedClips] = useState<Clip[]>(initialClips ?? [])
  const [messages, setMessages] = useState<Message[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionIdParam)
  const [userName, setUserName] = useState<string>('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const [clipsLoading, setClipsLoading] = useState(initialClips ? false : true)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [upgradeDescription, setUpgradeDescription] = useState<string | undefined>(undefined)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fetchRetryCount = useRef(0)
  const maxFetchRetries = 3
  /** File de caractères + rAF : affichage fluide (plus naturel que « un mot » fixe toutes les 180 ms). */
  const charQueueRef = useRef<string[]>([])
  const streamRafRef = useRef<number | null>(null)

  useEffect(() => {
    setCurrentSessionId(sessionIdParam)
  }, [sessionIdParam])

  useEffect(() => {
    if (initialClips) return
    if (clipIdsParam) {
      const ids = clipIdsParam.split(',').filter(Boolean)
      if (ids.length > 0 && selectedClips.length === 0) {
        setSelectedClips(ids.map(id => ({
          id,
          product_name: 'Chargement…',
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

    async function fetchClips() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const token = embedAccessToken ?? (await supabase.auth.getSession()).data.session?.access_token

      let resolvedUser = user
      if (!resolvedUser && token) {
        try {
          const { data: { user: jwtUser } } = await (supabase.auth as any).getUser(token)
          resolvedUser = jwtUser
        } catch { /* ignore */ }
      }

      if (resolvedUser) {
        const meta = (resolvedUser.user_metadata ?? {}) as Record<string, any>
        const name = meta.full_name || meta.name || (resolvedUser.email ? resolvedUser.email.split('@')[0] : '') || ''
        setUserName(String(name))
      }

      if (!resolvedUser && !token) {
        if (clipIdsParam && fetchRetryCount.current < maxFetchRetries) {
          fetchRetryCount.current += 1
          setTimeout(() => fetchClips(), 400)
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
        if (all) setAllClips(all)
      }

      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      if (sessionIdParam) {
        const res = await fetch(`/api/chat/sessions/${sessionIdParam}`, { headers, credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          if (data.messages?.length) setMessages(data.messages)
          if (data.clips?.length) setSelectedClips(data.clips)
          setCurrentSessionId(data.session?.id ?? sessionIdParam)
        }
      } else if (clipIdsParam) {
        const ids = clipIdsParam.split(',').filter(Boolean)
        if (ids.length > 0) {
          const res = await fetch(`/api/clips?ids=${encodeURIComponent(ids.join(','))}`, { headers, credentials: 'same-origin' })
          if (res.ok) {
            const data = await res.json()
            if (data.clips?.length) setSelectedClips(data.clips)
          } else if (res.status === 401 && typeof window !== 'undefined' && window.parent) {
            window.parent.postMessage({ type: 'sumear-request-auth' }, '*')
          }
          if (!res.ok && resolvedUser) {
            const { data } = await supabase
              .from('clips')
              .select('id, product_name, brand, price, currency, image_url, source_domain, rating, review_count')
              .in('id', ids)
            if (data?.length) setSelectedClips(data)
          }
        }
      }

      setClipsLoading(false)
    }
    fetchClips()
  }, [clipIdsParam, sessionIdParam, embedAccessToken, isEmbed])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamingContent])

  function removeClip(id: string) {
    setSelectedClips(prev => prev.filter(c => c.id !== id))
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading || selectedClips.length === 0) return
    if (text.length > MAX_MESSAGE_LENGTH) return

    const userMessage: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      let token = embedAccessToken
      if (!token) {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        token = session?.access_token ?? null
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          clip_ids: selectedClips.map(c => c.id),
          message: text,
          history: messages,
          session_id: currentSessionId ?? undefined,
        }),
        credentials: 'same-origin',
      })

      // Non-200 (auth, quota, etc.) — still JSON
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}))
        const isLimit = data.code === 'DAILY_LIMIT' || data.code === 'QUOTA_EXCEEDED'
        if (data.code === 'QUOTA_EXCEEDED') {
          setUpgradeDescription(typeof data.error === 'string' ? data.error : undefined)
          setUpgradeOpen(true)
        }
        setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'Erreur.', isLimit }])
        setLoading(false)
        return
      }

      // Stream SSE : remplir une file de caractères, vidage progressif via rAF (flux type frappe douce)
      setLoading(false)
      setStreamingContent('')

      if (streamRafRef.current != null) {
        cancelAnimationFrame(streamRafRef.current)
        streamRafRef.current = null
      }
      charQueueRef.current = []

      let fullReply = ''
      let streamDone = false
      let doneSessionId: string | null = null
      let displayedText = ''

      // ~40 caractères/s en base ; un peu plus vite si la file grossit (évite un long retard en fin de stream)
      const MS_PER_CHAR = 24
      let lastFrame = performance.now()
      let drainCarry = 0

      const runDrain = (now: number) => {
        const dt = Math.min(now - lastFrame, 80)
        lastFrame = now
        drainCarry += dt / MS_PER_CHAR

        const queue = charQueueRef.current
        let didExtend = false
        while (drainCarry >= 1 && queue.length > 0) {
          drainCarry -= 1
          displayedText += queue.shift()!
          didExtend = true
        }
        if (queue.length > 100) {
          const burst = Math.min(3, queue.length)
          for (let i = 0; i < burst; i++) {
            displayedText += queue.shift()!
            didExtend = true
          }
          drainCarry *= 0.65
        }

        if (didExtend) setStreamingContent(displayedText)

        if (streamDone && queue.length === 0) {
          if (streamRafRef.current != null) cancelAnimationFrame(streamRafRef.current)
          streamRafRef.current = null
          setStreamingContent(null)
          setMessages(prev => [...prev, { role: 'assistant', content: fullReply }])
          if (doneSessionId && !currentSessionId) {
            setCurrentSessionId(doneSessionId)
            const url = new URL(window.location.href)
            url.searchParams.set('session_id', doneSessionId)
            window.history.replaceState({}, '', url.pathname + '?' + url.searchParams.toString())
          }
          return
        }

        streamRafRef.current = requestAnimationFrame(runDrain)
      }
      streamRafRef.current = requestAnimationFrame(runDrain)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let sseBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        sseBuffer += decoder.decode(value, { stream: true })

        const lines = sseBuffer.split('\n')
        sseBuffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const payload = JSON.parse(line.slice(6))
            if (payload.chunk) {
              fullReply += payload.chunk
              for (const ch of payload.chunk) charQueueRef.current.push(ch)
            } else if (payload.error) {
              if (streamRafRef.current != null) cancelAnimationFrame(streamRafRef.current)
              streamRafRef.current = null
              charQueueRef.current = []
              setStreamingContent(null)
              setMessages(prev => [...prev, { role: 'assistant', content: payload.error }])
            } else if (payload.done) {
              doneSessionId = payload.session_id
              streamDone = true
            }
          } catch { /* skip malformed line */ }
        }
      }
    } catch {
      if (streamRafRef.current != null) cancelAnimationFrame(streamRafRef.current)
      streamRafRef.current = null
      charQueueRef.current = []
      setStreamingContent(null)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Impossible de contacter le serveur.' }])
    }
    setLoading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
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
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9F4F0' }}>
          <div className="w-6 h-6 border-2 border-[#EDE8DF] border-t-[#B8715A] rounded-full animate-spin" />
        </div>
      )
      : (
        <div className="flex items-center justify-center h-[42vh]">
          <div className="w-5 h-5 border-2 border-[#EDE8DF] border-t-[#B8715A] rounded-full animate-spin" />
        </div>
      )
  }

  const isLoadingPlaceholder = (name: string) => name === 'Chargement…'
  const charCount = input.length
  const charNearLimit = charCount > 450
  const charOverLimit = charCount > MAX_MESSAGE_LENGTH
  const inputPlaceholder = selectedClips.length === 0
    ? "Sélectionnez d'abord des produits..."
    : selectedClips.length === 1
    ? "Posez une question sur ce produit..."
    : "Posez une question sur ces produits..."

  const suggestions = selectedClips.length <= 1 ? SUGGESTIONS_SINGLE : SUGGESTIONS_MULTI
  const userInitial = userName ? userName[0].toUpperCase() : 'U'

  // ── Derived insight chips from product metadata ────────────────────────────
  const insightChips: { dot: string; label: string; value: string }[] = []
  const primaryClip = selectedClips[0] ?? null
  if (primaryClip && !isLoadingPlaceholder(primaryClip.product_name)) {
    if (primaryClip.price != null) {
      insightChips.push({
        dot: '#6A9E6A',
        label: 'Prix',
        value: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: primaryClip.currency || 'EUR' }).format(primaryClip.price),
      })
    }
    if (primaryClip.rating != null) {
      insightChips.push({
        dot: primaryClip.rating >= 4 ? '#6A9E6A' : primaryClip.rating >= 3 ? '#B09890' : '#C07070',
        label: 'Note',
        value: `${primaryClip.rating.toFixed(1)}/5`,
      })
    }
    if (primaryClip.review_count != null && primaryClip.review_count > 0) {
      insightChips.push({ dot: '#B09890', label: 'Avis', value: primaryClip.review_count.toLocaleString('fr-FR') })
    }
  }

  // ── Shared input row (textarea + send button) ─────────────────────────────
  const inputRow = (
    <div style={{ padding: '8px 20px 0', flexShrink: 0 }}>
      <div style={{
        display: 'flex',
        gap: 10,
        background: '#FFFCFA',
        border: '0.5px solid rgba(42,30,24,.12)',
        borderRadius: 28,
        padding: '10px 10px 10px 18px',
        boxShadow: '0 2px 10px rgba(0,0,0,.04)',
        alignItems: 'center',
      }}>
        <textarea
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
            color: '#2A1E18',
            fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
            background: 'transparent',
            resize: 'none',
            lineHeight: 1.5,
          }}
          className="placeholder-[#B09890] scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none]"
        />
        <button
          onClick={handleSend}
          disabled={loading || streamingContent !== null || !input.trim() || selectedClips.length === 0 || charOverLimit}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#B8715A',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: (loading || streamingContent !== null || !input.trim() || selectedClips.length === 0 || charOverLimit) ? 0.45 : 1,
            transition: 'opacity 0.12s',
          }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  )

  // ── Disclaimer + char counter ──────────────────────────────────────────────
  const disclaimer = (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px 24px 14px', flexShrink: 0 }}>
      <p style={{ fontSize: 9, color: '#B09890' }}>
        Sumear peut faire des erreurs. Vérifiez les informations importantes.
      </p>
      {charCount > 0 && (
        <span style={{ fontSize: 10, color: charOverLimit || charNearLimit ? '#C07070' : '#B09890', fontVariantNumeric: 'tabular-nums' }}>
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

  // ── Embed layout ───────────────────────────────────────────────────────────
  if (isEmbed) {
    const derivedLabel = selectedClips.length === 1
      ? (isLoadingPlaceholder(selectedClips[0].product_name) ? 'Chargement…' : selectedClips[0].product_name)
      : selectedClips.length > 1
      ? `${selectedClips.length} produits`
      : 'Chat produit'
    const contextLabel = topbarLabel ?? derivedLabel

    return (
      <>
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#F9F4F0',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
        fontSize: 14,
        ...(noZoom ? {} : { zoom: 1.5 }),
      }}>

        {/* ── Topbar ── */}
        <div style={{
          height: 42,
          minHeight: 42,
          background: '#2A1E18',
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
            Fermer ✕
          </button>
        </div>

        {/* ── Chat body ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {/* Messages zone — only scrollable area */}
          <div
            className="scrollbar-hide"
            style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            {/* Product cards */}
            {selectedClips.map(clip => {
              const isPlaceholder = isLoadingPlaceholder(clip.product_name)
              const priceStr = clip.price != null
                ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: clip.currency || 'EUR' }).format(clip.price)
                : null
              const ratingRounded = clip.rating != null ? Math.round(clip.rating) : null
              const starsStr = ratingRounded != null
                ? '★'.repeat(ratingRounded) + '☆'.repeat(5 - ratingRounded)
                : null

              return (
                <div key={clip.id} style={{
                  background: '#FFFCFA',
                  border: '0.5px solid rgba(42,30,24,.1)',
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
                    background: '#EDE8DF',
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
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#2A1E18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {isPlaceholder ? 'Chargement…' : clip.product_name}
                    </p>
                    {priceStr && (
                      <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 15, color: '#B8715A', marginTop: 2 }}>
                        {priceStr}
                      </p>
                    )}
                    {(starsStr || (clip.review_count != null && clip.review_count > 0)) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                        {starsStr && <span style={{ color: '#B8715A', fontSize: 10 }}>{starsStr}</span>}
                        {clip.review_count != null && clip.review_count > 0 && (
                          <span style={{ fontSize: 10, color: '#B09890' }}>{clip.review_count.toLocaleString('fr-FR')} avis</span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Remove */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeClip(clip.id) }}
                    style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#B09890', padding: 4, display: 'flex', alignItems: 'center' }}
                    aria-label="Retirer"
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
                    background: '#FFFCFA',
                    border: '0.5px solid rgba(42,30,24,.1)',
                    borderRadius: 20,
                    padding: '5px 10px',
                    fontSize: 11,
                    color: '#7A6258',
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
                    background: isUser ? '#EDD8CC' : '#B8715A',
                    color: isUser ? '#8C4A35' : 'white',
                    fontSize: isUser ? 10 : 9,
                    fontWeight: isUser ? 500 : 400,
                    fontFamily: isUser ? "'Plus Jakarta Sans', sans-serif" : "'Playfair Display', Georgia, serif",
                  }}>
                    {isUser ? userInitial : 'S'}
                  </div>
                  {/* Bubble */}
                  <div style={{
                    maxWidth: '78%',
                    background: msg.isLimit ? 'rgba(192,112,112,.07)' : isUser ? '#B8715A' : '#FFFCFA',
                    color: msg.isLimit ? '#C07070' : isUser ? 'white' : '#2A1E18',
                    border: isUser ? 'none' : msg.isLimit ? '0.5px solid rgba(192,112,112,.2)' : '0.5px solid rgba(42,30,24,.08)',
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
            {loading && (
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', background: '#B8715A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 2,
                  fontFamily: "'Playfair Display', Georgia, serif", fontSize: 9, color: 'white',
                }}>S</div>
                <div style={{ background: '#FFFCFA', border: '0.5px solid rgba(42,30,24,.08)', borderRadius: '4px 14px 14px 14px', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 150, 300].map(delay => (
                      <div key={delay} className="animate-bounce" style={{ width: 6, height: 6, borderRadius: '50%', background: '#B09890', animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Streaming message bubble */}
            {streamingContent !== null && (
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', background: '#B8715A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 2,
                  fontFamily: "'Playfair Display', Georgia, serif", fontSize: 9, color: 'white',
                }}>S</div>
                <div style={{ background: '#FFFCFA', border: '0.5px solid rgba(42,30,24,.08)', borderRadius: '4px 14px 14px 14px', padding: '10px 14px', fontSize: 12, lineHeight: 1.7, color: '#2A1E18', maxWidth: '80%' }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {streamingContent}
                    <span className="animate-pulse" style={{ display: 'inline-block', width: 2, height: '1em', background: '#B8715A', marginLeft: 2, verticalAlign: 'text-bottom', borderRadius: 1 }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion chips */}
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
                    background: '#FFFCFA',
                    border: '0.5px solid rgba(42,30,24,.12)',
                    borderRadius: 20,
                    padding: '6px 13px',
                    fontSize: 11,
                    color: '#7A6258',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F0E8E0')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#FFFCFA')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

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
  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: '#F9F4F0', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>

      {/* Messages zone */}
      <div
        className="scrollbar-hide"
        style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        {/* Product cards */}
        {selectedClips.map(clip => {
          const isPlaceholder = isLoadingPlaceholder(clip.product_name)
          const priceStr = clip.price != null
            ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: clip.currency || 'EUR' }).format(clip.price)
            : null

          return (
            <div key={clip.id} style={{
              background: '#FFFCFA',
              border: '0.5px solid rgba(42,30,24,.1)',
              borderRadius: 14,
              padding: '12px 14px',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexShrink: 0,
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: '#EDE8DF', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {clip.image_url && !isPlaceholder ? (
                  <img src={clip.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} referrerPolicy="no-referrer" />
                ) : (
                  <span style={{ fontSize: 18 }}>{isPlaceholder ? '⋯' : '📦'}</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: '#2A1E18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isPlaceholder ? 'Chargement…' : clip.product_name}
                </p>
                {priceStr && (
                  <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 14, color: '#B8715A', marginTop: 2 }}>{priceStr}</p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeClip(clip.id) }}
                style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#B09890', padding: 4 }}
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
              <div key={i} style={{ background: '#FFFCFA', border: '0.5px solid rgba(42,30,24,.1)', borderRadius: 20, padding: '5px 10px', fontSize: 11, color: '#7A6258', display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: chip.dot, flexShrink: 0 }} />
                {chip.label} <strong>{chip.value}</strong>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user'
          return (
            <div key={i} style={{ display: 'flex', gap: 9, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, background: isUser ? '#EDD8CC' : '#B8715A', color: isUser ? '#8C4A35' : 'white', fontSize: isUser ? 10 : 9, fontFamily: isUser ? "'Plus Jakarta Sans', sans-serif" : "'Playfair Display', serif" }}>
                {isUser ? userInitial : 'S'}
              </div>
              <div style={{ maxWidth: '78%', background: msg.isLimit ? 'rgba(192,112,112,.07)' : isUser ? '#B8715A' : '#FFFCFA', color: msg.isLimit ? '#C07070' : isUser ? 'white' : '#2A1E18', border: isUser ? 'none' : msg.isLimit ? '0.5px solid rgba(192,112,112,.2)' : '0.5px solid rgba(42,30,24,.08)', borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px', padding: '10px 14px', fontSize: 12, lineHeight: 1.7 }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              </div>
            </div>
          )
        })}

        {loading && (
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#B8715A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, fontFamily: "'Playfair Display', serif", fontSize: 9, color: 'white' }}>S</div>
            <div style={{ background: '#FFFCFA', border: '0.5px solid rgba(42,30,24,.08)', borderRadius: '4px 14px 14px 14px', padding: '10px 14px' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 150, 300].map(delay => (
                  <div key={delay} className="animate-bounce" style={{ width: 6, height: 6, borderRadius: '50%', background: '#B09890', animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion chips */}
      <div className="scrollbar-hide" style={{ padding: '4px 28px 10px', overflowX: 'auto', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'nowrap' }}>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => setInput(s)} style={{ background: '#FFFCFA', border: '0.5px solid rgba(42,30,24,.12)', borderRadius: 20, padding: '6px 13px', fontSize: 11, color: '#7A6258', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F0E8E0')}
              onMouseLeave={e => (e.currentTarget.style.background = '#FFFCFA')}
            >{s}</button>
          ))}
        </div>
      </div>

      {inputBar}
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
