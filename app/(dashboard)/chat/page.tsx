'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface Clip {
  id: string
  product_name: string
  brand: string | null
  price: number | null
  currency: string
  image_url: string | null
  source_domain: string
}
interface Message { role: 'user' | 'assistant'; content: string }

function ChatContent() {
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

  useEffect(() => {
    setCurrentSessionId(sessionIdParam)
  }, [sessionIdParam])

  useEffect(() => {
    async function fetchClips() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setClipsLoading(false); return }

      const { data: all } = await supabase
        .from('clips')
        .select('id, product_name, brand, price, currency, image_url, source_domain')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (all) setAllClips(all)

      if (sessionIdParam) {
        const res = await fetch(`/api/chat/sessions/${sessionIdParam}`)
        if (res.ok) {
          const data = await res.json()
          if (data.messages?.length) setMessages(data.messages)
          if (data.clips?.length) setSelectedClips(data.clips)
          setCurrentSessionId(data.session?.id ?? sessionIdParam)
        }
      } else if (clipIdsParam) {
        const ids = clipIdsParam.split(',').filter(Boolean)
        const { data } = await supabase
          .from('clips')
          .select('id, product_name, brand, price, currency, image_url, source_domain')
          .in('id', ids)
        if (data) setSelectedClips(data)
      }

      setClipsLoading(false)
    }
    fetchClips()
  }, [clipIdsParam, sessionIdParam])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function toggleClip(clip: Clip) {
    setSelectedClips(prev => {
      const exists = prev.find(c => c.id === clip.id)
      if (exists) return prev.filter(c => c.id !== clip.id)
      if (prev.length >= 5) return prev
      return [...prev, clip]
    })
  }

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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clip_ids: selectedClips.map(c => c.id),
          message: text,
          history: messages,
          session_id: currentSessionId ?? undefined,
        }),
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
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-6 h-6 border-2 border-[#333] border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  const suggestions = selectedClips.length === 1
    ? ['Ce produit vaut-il le coup ?', 'Quels red flags ?', 'Alternatives moins chères', 'Avis des utilisateurs']
    : ['Lequel me recommandes-tu ?', 'Meilleur rapport qualité-prix ?', 'Quels red flags ?', 'Alternatives']

  const hasMessages = messages.length > 0

  const inputBlock = (
    <div className="max-w-3xl mx-auto w-full px-2">
      {messages.length === 0 && selectedClips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => setInput(s)}
              className="px-3 py-1.5 text-xs bg-[#25252a] border border-[#3a3a40] text-[#888] rounded-full hover:border-violet-500/50 hover:text-violet-400 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2 rounded-2xl bg-[#25252a] border border-[#3a3a40] p-2 focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/20">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedClips.length > 0 ? 'Posez une question sur ces produits...' : 'Sélectionnez d\'abord des produits...'}
          disabled={selectedClips.length === 0}
          rows={1}
          className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-white placeholder-[#555] focus:outline-none disabled:opacity-40 min-h-[24px]"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim() || selectedClips.length === 0}
          className="p-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-500 disabled:bg-[#3a3a40] disabled:text-[#555] transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
      <p className="text-center text-[10px] text-[#444] mt-2">
        BriefAI peut faire des erreurs. Vérifiez les informations importantes.
      </p>
    </div>
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Product context bar */}
      {selectedClips.length > 0 && (
        <div className="shrink-0 p-4 border-b border-[#2e2e33] overflow-x-auto">
          <div className="flex gap-2">
            {selectedClips.map(clip => (
              <div key={clip.id} className="flex items-center gap-2 shrink-0 bg-[#25252a] border border-[#3a3a40] rounded-lg px-3 py-2 max-w-[200px]">
                {clip.image_url ? (
                  <img src={clip.image_url} alt="" className="w-8 h-8 rounded object-contain bg-[#111]" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded bg-[#3a3a40] flex items-center justify-center text-xs">📦</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate">{clip.product_name}</p>
                  {clip.price != null && (
                    <p className="text-[10px] text-[#888]">
                      {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: clip.currency || 'EUR' }).format(clip.price)}
                    </p>
                  )}
                </div>
                <button onClick={() => removeClip(clip.id)} className="text-[#555] hover:text-white shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {selectedClips.length < 5 && allClips.filter(c => !selectedClips.find(s => s.id === c.id)).length > 0 && (
              <div className="relative group shrink-0">
                <button className="h-full px-3 py-2 border border-dashed border-[#333] rounded-lg text-xs text-[#555] hover:border-violet-500 hover:text-violet-400 transition-colors">
                  + Ajouter
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!hasMessages ? (
        /* Style ChatGPT : contenu + barre de saisie au centre */
        <div className="flex-1 min-h-0 flex flex-col justify-center items-center px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-2xl flex flex-col items-center gap-6">
            {selectedClips.length === 0 ? (
              <>
                <div className="text-center">
                  <h2 className="text-2xl font-semibold text-white">Comment puis-je vous aider ?</h2>
                  <p className="text-sm text-[#888] mt-2 max-w-md mx-auto">
                    Sélectionnez des produits depuis la page Produits, ou commencez une conversation.
                  </p>
                </div>
                {inputBlock}
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-white text-center">
                  {selectedClips.length === 1
                    ? `Posez une question sur "${selectedClips[0].product_name.substring(0, 40)}..."`
                    : `Posez une question sur ces ${selectedClips.length} produits`
                  }
                </h2>
                {inputBlock}
              </>
            )}
          </div>
        </div>
      ) : (
        /* Avec messages : zone de messages + barre en bas */
        <>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-violet-600 text-white'
                      : 'bg-[#25252a] border border-[#3a3a40] text-[#ddd]'
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-[#25252a] border border-[#3a3a40] rounded-2xl px-4 py-3">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <div className="shrink-0 border-t border-[#2e2e33] px-4 py-4">
            {inputBlock}
          </div>
        </>
      )}
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatContent />
    </Suspense>
  )
}
