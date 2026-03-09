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
  extraction_method: string
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
        .select('id, product_name, brand, source_domain, source_url, image_url, price, currency, rating, review_count, extraction_method, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (data) setClips(data)
      if (error) setError('Erreur lors du chargement des clips.')
      setLoading(false)
    }

    fetchClips()
  }, [])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 5) {
        next.add(id)
      }
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

      if (!response.ok) {
        setError(data.error || 'Erreur lors de la comparaison.')
        setComparing(false)
        return
      }

      router.push(`/compare/${data.comparison_id}`)
    } catch {
      setError('Impossible de contacter le serveur.')
      setComparing(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="mx-auto w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clips</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sélectionnez 2 à 5 produits pour les comparer avec l&apos;IA.
          </p>
        </div>

        {selected.size >= 2 && (
          <button
            onClick={handleCompare}
            disabled={comparing}
            className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
          >
            {comparing ? 'Analyse en cours...' : `Comparer (${selected.size} produits)`}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {selected.size === 1 && (
        <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
          Sélectionnez au moins 1 autre produit pour comparer.
        </div>
      )}

      {clips.length === 0 ? (
        <div className="mt-8 text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900">Aucun clip</h3>
          <p className="mt-1 text-sm text-gray-500">Utilisez l&apos;extension pour clipper des produits.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              isSelected={selected.has(clip.id)}
              onToggle={() => toggleSelect(clip.id)}
              selectionDisabled={selected.size >= 5 && !selected.has(clip.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ClipCard({ clip, isSelected, onToggle, selectionDisabled }: {
  clip: Clip
  isSelected: boolean
  onToggle: () => void
  selectionDisabled: boolean
}) {
  const formattedPrice = clip.price != null
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: clip.currency || 'EUR' }).format(clip.price)
    : null

  const formattedDate = new Date(clip.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })

  const stars = clip.rating != null
    ? '★'.repeat(Math.round(clip.rating)) + '☆'.repeat(5 - Math.round(clip.rating))
    : null

  return (
    <div
      onClick={() => !selectionDisabled && onToggle()}
      className={`relative rounded-lg border bg-white overflow-hidden transition-all cursor-pointer ${
        isSelected
          ? 'border-gray-900 ring-2 ring-gray-900/10 shadow-md'
          : selectionDisabled
          ? 'border-gray-100 opacity-50 cursor-not-allowed'
          : 'border-gray-200 hover:shadow-md'
      }`}
    >
      {/* Checkbox */}
      <div className="absolute top-3 right-3 z-10">
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          isSelected
            ? 'bg-gray-900 border-gray-900 text-white'
            : 'bg-white border-gray-300'
        }`}>
          {isSelected && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
        </div>
      </div>

      {/* Image */}
      <div className="h-40 bg-gray-50 flex items-center justify-center">
        {clip.image_url ? (
          <img
            src={clip.image_url}
            alt={clip.product_name}
            className="h-full w-full object-contain p-3"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="text-gray-300 text-4xl">📦</div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">
          {clip.product_name}
        </p>

        {clip.brand && (
          <p className="mt-1 text-xs text-gray-500">{clip.brand}</p>
        )}

        <div className="mt-2 flex items-center justify-between">
          {formattedPrice && (
            <span className="text-base font-bold text-emerald-600">{formattedPrice}</span>
          )}
          {stars && (
            <span className="text-xs text-amber-500" title={`${clip.rating}/5 (${clip.review_count ?? 0} avis)`}>
              {stars} {clip.rating}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
          <span>{clip.source_domain}</span>
          <span>{formattedDate}</span>
        </div>
      </div>
    </div>
  )
}