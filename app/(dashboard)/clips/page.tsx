'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Clip {
  id: string
  product_name: string
  brand: string | null
  source_domain: string
  source_url: string
  image_url: string | null
  price: number | null
  currency: string
  rating: number | null
  review_count: number | null
  created_at: string
}

export default function ClipsPage() {
  const [clips, setClips] = useState<Clip[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function fetchClips() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from('clips')
        .select('id, product_name, brand, source_domain, source_url, image_url, price, currency, rating, review_count, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (data) setClips(data)
      if (error) setError('Erreur lors du chargement.')
      setLoading(false)
    }
    fetchClips()
  }, [])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 5) next.add(id)
      return next
    })
  }

  async function handleCompare() {
    if (selected.size < 2) return
    setComparing(true)
    setError(null)
    try {
      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip_ids: Array.from(selected) }),
      })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Erreur.'); setComparing(false); return }
      router.push(`/compare/${data.comparison_id}`)
    } catch {
      setError('Impossible de contacter le serveur.')
      setComparing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-6 h-6 border-2 border-gray-300 dark:border-[#333] border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Produits clippés</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#888]">
            Sélectionnez un ou plusieurs produits pour discuter ou comparer (max. 5).
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {selected.size === 1 && (
            <button
              onClick={() => router.push(`/chat?clips=${Array.from(selected).join(',')}`)}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 rounded-xl hover:bg-violet-500 transition-colors shadow-sm"
            >
              Discuter
            </button>
          )}
          {selected.size >= 2 && (
            <>
              <button
                onClick={() => router.push(`/chat?clips=${Array.from(selected).join(',')}`)}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-[#2a2a2e] border border-gray-200 dark:border-[#404040] rounded-xl hover:bg-gray-50 dark:hover:bg-[#353538] transition-colors"
              >
                Discuter
              </button>
              <button
                onClick={handleCompare}
                disabled={comparing}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 rounded-xl hover:bg-violet-500 disabled:opacity-50 transition-colors shadow-sm"
              >
                {comparing ? 'Analyse…' : `Comparer (${selected.size})`}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {clips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-[#404040] bg-gray-50/50 dark:bg-[#1e1e22]/50 py-16 px-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-200 dark:bg-[#393E46] flex items-center justify-center text-2xl mb-4">📦</div>
          <p className="text-sm font-medium text-gray-600 dark:text-[#888]">Aucun produit clippé</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-[#666]">Utilisez l’extension BriefAI sur une page produit pour enregistrer vos premiers produits.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
          {clips.map((clip) => (
            <ProductCard
              key={clip.id}
              clip={clip}
              isSelected={selected.has(clip.id)}
              onToggle={() => toggleSelect(clip.id)}
              disabled={selected.size >= 5 && !selected.has(clip.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function formatRelativeDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `Il y a ${diffDays} j.`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function ProductCard({ clip, isSelected, onToggle, disabled }: {
  clip: Clip; isSelected: boolean; onToggle: () => void; disabled: boolean
}) {
  const price = clip.price != null
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: clip.currency || 'EUR' }).format(clip.price)
    : null
  const stars = clip.rating != null
    ? '★'.repeat(Math.round(clip.rating)) + '☆'.repeat(5 - Math.round(clip.rating))
    : null

  return (
    <article
      onClick={() => !disabled && onToggle()}
      className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-[#1a1a1e] shadow-lg shadow-violet-500/10'
          : disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20'
      }`}
    >
      <div className={`rounded-2xl border overflow-hidden transition-colors ${
        isSelected
          ? 'border-violet-500 bg-white dark:bg-[#2a2a2e]'
          : 'border-gray-200 dark:border-[#404040] bg-white dark:bg-[#252528] hover:border-gray-300 dark:hover:border-[#4a4a4e]'
      }`}>
        {/* Image */}
        <div className="aspect-[4/3] bg-gray-100 dark:bg-[#1a1a1e] flex items-center justify-center overflow-hidden">
          {clip.image_url ? (
            <img
              src={clip.image_url}
              alt=""
              className="w-full h-full object-contain p-5 group-hover:scale-[1.02] transition-transform duration-200"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-4xl text-gray-300 dark:text-[#404040]">📦</span>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug">
            {clip.product_name}
          </p>
          {clip.brand && (
            <p className="mt-1 text-xs text-gray-500 dark:text-[#888]">{clip.brand}</p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            {price && (
              <span className="text-base font-bold text-gray-900 dark:text-white">{price}</span>
            )}
            {stars && (
              <span className="text-xs text-amber-500 dark:text-amber-400" title={`${clip.rating}/5`}>
                {stars}
              </span>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#353538] flex items-center justify-between text-[11px] text-gray-400 dark:text-[#666]">
            <span className="truncate">{clip.source_domain}</span>
            <span className="shrink-0 ml-2">{formatRelativeDate(clip.created_at)}</span>
          </div>
        </div>

        {/* Selection badge */}
        <div className="absolute top-3 right-3 z-10">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-violet-500 text-white shadow-md'
                : 'bg-white/90 dark:bg-[#2a2a2e]/90 border border-gray-200 dark:border-[#444] backdrop-blur-sm'
            }`}
          >
            {isSelected ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full border-2 border-gray-300 dark:border-[#555]" />
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
