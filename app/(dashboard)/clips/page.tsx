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
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Produits</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#888]">
            Sélectionnez des produits pour discuter ou comparer.
          </p>
        </div>
        <div className="flex gap-2">
          {selected.size === 1 && (
            <button
              onClick={() => router.push(`/chat?clips=${Array.from(selected).join(',')}`)}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-violet-500 rounded-lg hover:from-violet-500 hover:to-violet-400 transition-all"
            >
              💬 Discuter
            </button>
          )}
          {selected.size >= 2 && (
            <>
              <button
                onClick={() => router.push(`/chat?clips=${Array.from(selected).join(',')}`)}
                className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white bg-gray-200 dark:bg-[#2e2e33] border border-gray-300 dark:border-[#3a3a40] rounded-lg hover:bg-gray-300 dark:hover:bg-[#3a3a40] transition-colors"
              >
                💬 Discuter
              </button>
              <button
                onClick={handleCompare}
                disabled={comparing}
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-violet-500 rounded-lg hover:from-violet-500 hover:to-violet-400 disabled:opacity-50 transition-all"
              >
                {comparing ? 'Analyse...' : `Comparer (${selected.size})`}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {clips.length === 0 ? (
        <div className="mt-8 text-center py-12 border-2 border-dashed border-gray-300 dark:border-[#3a3a40] rounded-xl bg-[#F5F0E8] dark:bg-transparent shadow-sm dark:shadow-none">
          <p className="text-sm text-gray-500 dark:text-[#555]">Aucun produit. Utilisez l&apos;extension pour clipper.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
    <div
      onClick={() => !disabled && onToggle()}
      className={`relative rounded-xl bg-[#F5F0E8] dark:bg-[#25252a] border-2 overflow-hidden cursor-pointer transition-all shadow-sm dark:shadow-none ${
        isSelected
          ? 'border-violet-500 ring-2 ring-violet-500/30'
          : disabled
          ? 'border-gray-300 dark:border-[#3a3a40] opacity-40 cursor-not-allowed'
          : 'border-gray-300 dark:border-[#3a3a40] hover:border-gray-400 dark:hover:border-[#4a4a52]'
      }`}
    >
      {/* Checkbox */}
      <div className="absolute top-3 right-3 z-10">
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          isSelected ? 'bg-violet-500 border-violet-500' : 'bg-white dark:bg-transparent border-gray-400 dark:border-[#444]'
        }`}>
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
        </div>
      </div>

      {/* Image */}
      <div className="h-36 bg-gray-100 dark:bg-[#111] flex items-center justify-center">
        {clip.image_url ? (
          <img src={clip.image_url} alt="" className="h-full w-full object-contain p-4" referrerPolicy="no-referrer" />
        ) : (
          <span className="text-gray-400 dark:text-[#333] text-3xl">📦</span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 leading-tight">{clip.product_name}</p>
        {clip.brand && <p className="mt-1 text-xs text-gray-600 dark:text-[#666]">{clip.brand}</p>}
        <div className="mt-2 flex items-center justify-between">
          {price && <span className="text-base font-bold text-gray-900 dark:text-white">{price}</span>}
          {stars && <span className="text-xs text-amber-500 dark:text-amber-400">{stars}</span>}
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500 dark:text-[#555]">
          <span>{clip.source_domain}</span>
          <span>{new Date(clip.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
        </div>
      </div>
    </div>
  )
}
