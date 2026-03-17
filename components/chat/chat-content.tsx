'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'

/** URL d’image proxifiée pour l’embed (évite CORS / 403). */
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
interface Message { role: 'user' | 'assistant'; content: string }

export function ChatContent({ embedAccessToken = null, isEmbed = false }: { embedAccessToken?: string | null; isEmbed?: boolean }) {
  const searchParams = useSearchParams()
  const clipIdsParam = searchParams.get('clips')
  const sessionIdParam = searchParams.get('session_id')

  const [allClips, setAllClips] = useState<Clip[]>([])
  const [selectedClips, setSelectedClips] = useState<Clip[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionIdParam)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [clipsLoading, setClipsLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fetchRetryCount = useRef(0)
  const maxFetchRetries = 3

  useEffect(() => {
    setCurrentSessionId(sessionIdParam)
  }, [sessionIdParam])

  useEffect(() => {
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
    // En mode embed, ne pas fetcher tant qu'on n'a pas le token (éviter 401 et "Chargement…" bloqué)
    if (isEmbed && !embedAccessToken) {
      return
    }

    async function fetchClips() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const token = embedAccessToken ?? (await supabase.auth.getSession()).data.session?.access_token

      if (!user && !token) {
        if (clipIdsParam && fetchRetryCount.current < maxFetchRetries) {
          fetchRetryCount.current += 1
          setTimeout(() => fetchClips(), 400)
          return
        }
        setClipsLoading(false)
        return
      }

      if (user) {
        const { data: all } = await supabase
          .from('clips')
          .select('id, product_name, brand, price, currency, image_url, source_domain, rating, review_count')
          .eq('user_id', user.id)
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
            window.parent.postMessage({ type: 'briefai-request-auth' }, '*')
          }
          if (!res.ok && user) {
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

  function removeClip(id: string) {
    setSelectedClips(prev => prev.filter(c => c.id !== id))
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading || selectedClips.length === 0) return

    const userMessage: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      let token = embedAccessToken
      if (!token) {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        token = session?.access_token ?? undefined
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
      const data = await response.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.ok ? data.reply : (data.error || 'Erreur.'),
      }])
      if (data.session_id && !currentSessionId) {
        setCurrentSessionId(data.session_id)
        const url = new URL(window.location.href)
        url.searchParams.set('session_id', data.session_id)
        window.history.replaceState({}, '', url.pathname + '?' + url.searchParams.toString())
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Impossible de contacter le serveur.' }])
    }
    setLoading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (clipsLoading) {
    return (
      <div className="flex items-center justify-center h-[42vh]">
        <div className="w-5 h-5 border-2 border-gray-300 dark:border-[#333] border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  const hasMessages = messages.length > 0

  const inputPlaceholder = selectedClips.length === 0
    ? "Sélectionnez d'abord des produits..."
    : selectedClips.length === 1
    ? "Posez une question sur ce produit..."
    : "Posez une question sur ces produits..."

  const inputBlock = (
    <div className={`w-full mx-auto ${isEmbed ? 'max-w-lg px-2' : 'max-w-2xl px-1.5'}`}>
      <div className={`flex gap-2 rounded-xl bg-gray-200 dark:bg-[#393E46] border border-gray-200 dark:border-[#393E46] focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/20 transition-shadow ${isEmbed ? 'p-2.5 shadow-sm' : 'p-1.5'}`}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={inputPlaceholder}
          disabled={selectedClips.length === 0}
          rows={1}
          className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-[#555] focus:outline-none disabled:opacity-40 min-h-[44px] scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none]"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim() || selectedClips.length === 0}
          className="p-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-500 disabled:bg-gray-400 dark:disabled:bg-[#434850] disabled:text-gray-500 dark:disabled:text-[#555] transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
      <p className={`text-center text-gray-400 dark:text-[#555] mt-1.5 ${isEmbed ? 'text-[9px]' : 'text-[9px]'}`}>
        BriefAI peut faire des erreurs. Vérifiez les informations importantes.
      </p>
    </div>
  )

  const isLoadingPlaceholder = (name: string) => name === 'Chargement…'
  const displayTitle = selectedClips.length === 1
    ? (isLoadingPlaceholder(selectedClips[0].product_name) ? 'Posez une question sur ce produit' : `Posez une question sur « ${selectedClips[0].product_name.length > 38 ? selectedClips[0].product_name.slice(0, 38) + '…' : selectedClips[0].product_name} »`)
    : `Posez une question sur ces ${selectedClips.length} produits`

  return (
    <div className="flex flex-col h-full min-h-0">
      {selectedClips.length > 0 && (
        <div className={`shrink-0 overflow-x-auto scrollbar-hide ${isEmbed ? 'px-3 py-3 border-b border-gray-200/80 dark:border-[#404040]' : 'p-2 border-b border-gray-200 dark:border-[#393E46]'}`}>
          <div className={`flex gap-3 ${isEmbed ? 'gap-3' : 'gap-1.5'}`}>
            {selectedClips.map(clip => {
              const loading = isLoadingPlaceholder(clip.product_name)
              const priceStr = clip.price != null
                ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: clip.currency || 'EUR' }).format(clip.price)
                : null
              const ratingStr = clip.rating != null
                ? `${'★'.repeat(Math.round(clip.rating))}${'☆'.repeat(5 - Math.round(clip.rating))} ${clip.rating.toFixed(1)}`
                : null
              const reviewsStr = clip.review_count != null && clip.review_count > 0
                ? `${clip.review_count} avis`
                : null

              return (
                <div
                  key={clip.id}
                  className={`shrink-0 rounded-xl border overflow-hidden transition-colors ${
                    isEmbed
                      ? 'bg-white dark:bg-[#252528] border-gray-200 dark:border-[#404040] shadow-sm w-[200px]'
                      : 'bg-gray-200 dark:bg-[#393E46] border-gray-200 dark:border-[#393E46] max-w-[160px]'
                  }`}
                >
                  {isEmbed ? (
                    <>
                      <div className="relative">
                        <div className="aspect-square bg-gray-100 dark:bg-[#1a1a1e] flex items-center justify-center">
                          {(clip.image_url && !loading) ? (
                            <img src={isEmbed ? (proxyImageUrl(clip.image_url) ?? clip.image_url) : clip.image_url} alt="" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-3xl text-gray-300 dark:text-[#404040]">{loading ? '⋯' : '📦'}</span>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeClip(clip.id) }}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
                          aria-label="Retirer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-medium text-gray-900 dark:text-white line-clamp-2 leading-snug min-h-[2rem]">
                          {loading ? 'Chargement…' : clip.product_name}
                        </p>
                        {!loading && (
                          <>
                            {priceStr && (
                              <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">{priceStr}</p>
                            )}
                            {(ratingStr || reviewsStr) && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                                {[ratingStr, reviewsStr].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 p-1.5">
                      <div className="w-6 h-6 rounded bg-gray-300 dark:bg-[#1a1a1e] flex items-center justify-center shrink-0">
                        {(clip.image_url && !loading) ? (
                          <img src={isEmbed ? (proxyImageUrl(clip.image_url) ?? clip.image_url) : clip.image_url} alt="" className="w-6 h-6 rounded object-contain" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-[10px]">{loading ? '⋯' : '📦'}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-gray-900 dark:text-white truncate">{loading ? 'Chargement…' : clip.product_name}</p>
                        {!loading && priceStr && <p className="text-[9px] text-gray-500 dark:text-[#888]">{priceStr}</p>}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removeClip(clip.id) }} className="shrink-0 p-1 text-gray-400 hover:text-gray-700 dark:hover:text-[#aaa] rounded" aria-label="Retirer">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!hasMessages ? (
        <div className={`flex-1 min-h-0 scrollbar-hide ${isEmbed ? 'relative' : 'flex flex-col justify-center items-center'} px-3 py-4 overflow-y-auto`}>
          {isEmbed ? (
            <div className="absolute inset-0 flex flex-col px-3 py-4">
              {selectedClips.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-full max-w-xl flex flex-col items-center gap-4">
                    <div className="text-center">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Comment puis-je vous aider ?</h2>
                      <p className="text-xs text-gray-500 dark:text-[#888] mt-1.5 max-w-sm mx-auto">
                        Sélectionnez des produits depuis la page Produits, ou commencez une conversation.
                      </p>
                    </div>
                    {inputBlock}
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white text-center shrink-0 pt-2 pb-1 px-2 leading-snug">
                    {displayTitle}
                  </h2>
                  <div className="flex-1 min-h-0 flex items-center justify-center">
                    {inputBlock}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="w-full max-w-xl flex flex-col items-center gap-4">
              {selectedClips.length === 0 ? (
                <>
                  <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Comment puis-je vous aider ?</h2>
                    <p className="text-xs text-gray-500 dark:text-[#888] mt-1.5 max-w-sm mx-auto">
                      Sélectionnez des produits depuis la page Produits, ou commencez une conversation.
                    </p>
                  </div>
                  {inputBlock}
                </>
              ) : (
                <>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white text-center shrink-0 pt-2 pb-1 w-full">
                    {displayTitle}
                  </h2>
                  <div className="flex-1 flex items-center justify-center w-full">
                    {inputBlock}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
            <div className="max-w-2xl mx-auto px-3 py-3 space-y-2.5">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-snug ${
                    msg.role === 'user'
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-200 dark:bg-[#393E46] border border-gray-200 dark:border-[#393E46] text-gray-800 dark:text-[#ddd]'
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 dark:bg-[#393E46] border border-gray-200 dark:border-[#393E46] rounded-xl px-3 py-2">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-gray-500 dark:bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-gray-500 dark:bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-gray-500 dark:bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <div className="shrink-0 border-t border-gray-200 dark:border-[#393E46] px-3 py-2.5">
            {inputBlock}
          </div>
        </>
      )}
    </div>
  )
}
