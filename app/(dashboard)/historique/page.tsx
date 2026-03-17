'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Session {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export default function HistoriquePage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch('/api/chat/sessions')
        if (!res.ok) return
        const data = await res.json()
        setSessions(data.sessions ?? [])
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()
  }, [])

  function formatDate(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 86400000) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    if (diff < 604800000) return d.toLocaleDateString('fr-FR', { weekday: 'short' })
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto flex items-center justify-center min-h-[40vh]">
        <div className="w-6 h-6 border-2 border-[#333] border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-white mb-2">Historique des discussions</h1>
      <p className="text-sm text-[#888] mb-6">
        Vos conversations sur les produits. Cliquez pour rouvrir une discussion.
      </p>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#393E46] p-8 text-center">
          <p className="text-[#888] text-sm">Aucune discussion pour le moment.</p>
          <Link
            href="/chat"
            className="inline-block mt-4 text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            Démarrer une conversation →
          </Link>
        </div>
      ) : (
        <ul className="space-y-1">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link
                href={`/chat?session_id=${session.id}`}
                className="flex items-center gap-3 rounded-xl px-4 py-3 bg-[#393E46] border border-[#393E46] hover:border-[#4a5059] transition-colors group"
              >
                <span className="flex-1 text-sm text-white truncate group-hover:text-violet-300 transition-colors">
                  {session.title || 'Discussion'}
                </span>
                <span className="text-[10px] text-[#555] shrink-0">
                  {formatDate(session.updated_at)}
                </span>
                <svg className="w-4 h-4 text-[#555] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
