'use client'

import { useState, useRef, useEffect } from 'react'

interface Message { role: 'user' | 'assistant'; content: string }

export function ComparisonChat({ comparisonId }: { comparisonId: string }) {
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
      const res = await fetch('/api/compare/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comparison_id: comparisonId, message: text, history: messages }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: res.ok ? data.reply : (data.error || 'Erreur.') }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erreur réseau.' }])
    }
    setLoading(false)
  }

  return (
    <div className="mt-8 rounded-xl bg-[#25252a] border border-[#3a3a40] overflow-hidden">
      <div className="px-5 py-3 bg-[#25252a] border-b border-[#3a3a40]">
        <h2 className="text-sm font-semibold text-white">💬 Posez vos questions</h2>
        <p className="text-[10px] text-[#555] mt-0.5">L&apos;IA connaît ces produits. Posez des questions spécifiques.</p>
      </div>

      <div className="max-h-80 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-[#555] py-4">Ex: &quot;Lequel est le plus adapté pour la montagne ?&quot;</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
              msg.role === 'user' ? 'bg-violet-600 text-white' : 'bg-[#25252a] border border-[#3a3a40] text-[#ddd]'
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#25252a] border border-[#3a3a40] rounded-xl px-4 py-2.5">
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

      <div className="border-t border-[#3a3a40] p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Votre question..."
          rows={1}
          className="flex-1 resize-none rounded-lg bg-[#25252a] border border-[#3a3a40] px-3 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-violet-500/50"
        />
        <button onClick={handleSend} disabled={loading || !input.trim()}
          className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-500 disabled:bg-[#3a3a40] disabled:text-[#555] transition-colors shrink-0">
          Envoyer
        </button>
      </div>
    </div>
  )
}
