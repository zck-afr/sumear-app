'use client'

import { useState, useRef, useEffect } from 'react'

interface Message { role: 'user' | 'assistant'; content: string }

export function ComparisonChat({ comparisonId, embedAccessToken = null }: { comparisonId: string; embedAccessToken?: string | null }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')
    setLoading(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (embedAccessToken) headers['Authorization'] = `Bearer ${embedAccessToken}`
      const res = await fetch('/api/compare/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ comparison_id: comparisonId, message: text, history: messages }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: res.ok ? data.reply : (data.error || 'Erreur.') }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erreur réseau.' }])
    }
    setLoading(false)
  }

  return (
    <div className="mt-8 rounded-xl bg-[#393E46] border border-[#393E46] overflow-hidden" style={{ pointerEvents: 'auto' }}>
      <div className="px-5 py-3 bg-[#393E46] border-b border-[#393E46]">
        <h2 className="text-sm font-semibold text-white">💬 Posez vos questions</h2>
        <p className="text-[10px] text-[#555] mt-0.5">L&apos;IA connaît ces produits. Posez des questions spécifiques.</p>
      </div>

      <div className="max-h-80 overflow-y-auto scrollbar-hide p-4 space-y-3" style={{ pointerEvents: 'auto' }}>
        {messages.length === 0 && (
          <p className="text-center text-xs text-[#555] py-4">Ex: &quot;Lequel est le plus adapté pour la montagne ?&quot;</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
              msg.role === 'user' ? 'bg-violet-600 text-white' : 'bg-[#393E46] border border-[#393E46] text-[#ddd]'
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#393E46] border border-[#393E46] rounded-xl px-4 py-2.5">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-[#555] rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-[#393E46] p-3 flex gap-2" style={{ pointerEvents: 'auto' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Votre question..."
          rows={1}
          className="flex-1 resize-none rounded-lg bg-[#393E46] border border-[#393E46] px-3 py-2.5 text-sm text-white placeholder-[#555] focus:outline-none focus:border-violet-500/50 cursor-text min-h-[44px] scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none]"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          tabIndex={0}
          aria-label="Votre question sur la comparaison"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-500 disabled:bg-[#434850] disabled:text-[#555] transition-colors shrink-0 cursor-pointer"
        >
          Envoyer
        </button>
      </div>
    </div>
  )
}
