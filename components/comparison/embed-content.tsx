'use client'

import { useState, useEffect } from 'react'
import { ComparisonChat } from './chat'

/** URL d’image éventuellement proxifiée pour éviter CORS / 403 en iframe. */
function imageSrc(url: string | null): string | null {
  if (!url || !url.startsWith('http')) return url
  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

/** Image produit avec repli visible si pas d’URL ou chargement échoue (403, CORS). */
function ProductImage({ src, alt = '', imgClassName, fallbackClassName, fallback }: { src: string | null; alt?: string; imgClassName?: string; fallbackClassName?: string; fallback: React.ReactNode }) {
  const [failed, setFailed] = useState(false)
  const resolvedSrc = imageSrc(src)
  if (!resolvedSrc || failed) {
    return (
      <div className={fallbackClassName} role="img" aria-hidden>
        {fallback}
      </div>
    )
  }
  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={imgClassName}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

interface Clip {
  id: string
  product_name: string
  brand: string | null
  price: number | null
  currency: string
  rating: number | null
  review_count: number | null
  image_url: string | null
  source_domain: string
}

interface Comparison {
  id: string
  status: string
  model_used: string | null
  result_analysis: any
  created_at: string
}

export function ComparisonEmbedContent({ comparisonId, accessToken }: { comparisonId: string; accessToken: string | null }) {
  const [data, setData] = useState<{ comparison: Comparison; clips: Clip[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const headers: Record<string, string> = {}
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    // Sans token : l’API utilisera les cookies (ouverture directe dans un onglet)
    fetch(`/api/compare/${comparisonId}`, { headers, credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) {
          const msg = res.status === 401
            ? accessToken
              ? 'Session expirée. Réessayez depuis l’extension.'
              : 'Connectez-vous sur BriefAI pour voir cette comparaison.'
            : res.status === 404
              ? 'Comparaison introuvable'
              : 'Erreur chargement'
          throw new Error(msg)
        }
        return res.json()
      })
      .then(setData)
      .catch((e) => setError(e?.message || 'Erreur'))
      .finally(() => setLoading(false))
  }, [comparisonId, accessToken])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto border-2 border-[#333] border-t-violet-500 rounded-full animate-spin" />
          <p className="mt-4 text-sm text-[#888]">Chargement de la comparaison...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    const isUnauth = error?.includes('Connectez-vous') || error?.includes('Session expirée') || error?.includes('Session manquante')
    return (
      <div className="flex items-center justify-center min-h-[40vh] p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-xl">✗</div>
          <p className="mt-4 text-sm text-[#888]">{error || 'Erreur'}</p>
          {isUnauth && (
            <div className="mt-3 flex flex-col gap-2 items-center">
              <button
                type="button"
                onClick={() => typeof window !== 'undefined' && window.parent.postMessage({ type: 'briefai-request-auth' }, '*')}
                className="text-sm px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors"
              >
                Rafraîchir la session
              </button>
              <a href="/login" target="_blank" rel="noopener noreferrer" className="text-sm text-violet-400 hover:underline">
                Ouvrir BriefAI et se connecter
              </a>
            </div>
          )}
        </div>
      </div>
    )
  }

  const { comparison, clips } = data
  const result = comparison.result_analysis

  if (comparison.status === 'pending') {
    return (
      <div className="flex items-center justify-center min-h-[40vh] p-6">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto border-2 border-[#333] border-t-violet-500 rounded-full animate-spin" />
          <p className="mt-4 text-sm text-[#888]">Analyse en cours...</p>
        </div>
      </div>
    )
  }

  if (comparison.status === 'failed' || !result?.verdict) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-xl">✗</div>
          <p className="mt-4 text-sm text-[#888]">L&apos;analyse a échoué.</p>
        </div>
      </div>
    )
  }

  const verdict = result.verdict
  const products = result.products || []
  const keyDiffs = result.key_differences || []

  /** Réduit un long titre produit pour le verdict (max 50 caractères). */
  const shortProductName = (name: string, maxLen = 50) =>
    name.length <= maxLen ? name : name.slice(0, maxLen - 1).trim() + '…'

  return (
    <div className="p-4 max-w-4xl mx-auto pb-8" style={{ pointerEvents: 'auto' }}>
      {/* Verdict */}
      {(() => {
        const winnerClip = verdict.winner_index != null ? clips[verdict.winner_index] : null
        return (
      <div className="mt-2 rounded-xl bg-[#393E46] border border-[#393E46] p-4">
        <div className="flex items-start gap-3">
          <div className={`shrink-0 w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center bg-[#252528] ring-2 ${
            verdict.is_clear_winner ? 'ring-emerald-500/50' : 'ring-amber-500/50'
          }`}>
            <ProductImage
              src={winnerClip?.image_url ?? null}
              imgClassName="w-full h-full object-contain"
              fallbackClassName="w-12 h-12 flex items-center justify-center text-lg bg-[#252528]"
              fallback={<span>{verdict.is_clear_winner ? '🏆' : '⚖️'}</span>}
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white" title={verdict.winner_index != null && clips[verdict.winner_index] ? clips[verdict.winner_index]!.product_name : undefined}>
              {verdict.winner_index != null && clips[verdict.winner_index]
                ? `${shortProductName(clips[verdict.winner_index]!.product_name)} l'emporte`
                : 'Match serré'}
            </h1>
            <p className="mt-1 text-xs text-[#aaa] leading-relaxed">{verdict.summary}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                verdict.confidence >= 0.8 ? 'bg-emerald-500/10 text-emerald-400' :
                verdict.confidence >= 0.5 ? 'bg-amber-500/10 text-amber-400' :
                'bg-[#434850] text-[#888]'
              }`}>
                Confiance : {Math.round(verdict.confidence * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
        )
      })()}

      {/* Product insights */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {products.map((product: any, i: number) => {
          const clip = clips[i]
          const isWinner = verdict.winner_index === i
          return (
            <div key={i} className={`rounded-xl bg-[#393E46] border p-3 ${
              isWinner ? 'border-violet-500/50 ring-1 ring-violet-500/10' : 'border-[#393E46]'
            }`}>
              <div className="flex items-start gap-2">
                <ProductImage
                  src={clip?.image_url ?? null}
                  imgClassName="w-10 h-10 rounded-lg object-contain bg-[#252528] shrink-0"
                  fallbackClassName="w-10 h-10 min-w-[2.5rem] min-h-[2.5rem] rounded-lg bg-[#252528] border border-[#434850] flex items-center justify-center text-[#666] text-sm shrink-0"
                  fallback={<span>📦</span>}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-white truncate">{product.name || clip?.product_name}</p>
                    {isWinner && <span className="shrink-0 text-[9px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full">Meilleur</span>}
                  </div>
                  {clip && (
                    <p className="text-[10px] text-[#666] mt-0.5">
                      {clip.price != null && `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: clip.currency || 'EUR' }).format(clip.price)} · `}
                      {clip.source_domain}
                    </p>
                  )}
                </div>
              </div>
              {product.strengths?.length > 0 && (
                <div className="mt-3">
                  <p className="text-[9px] font-semibold text-emerald-400 uppercase">Forces</p>
                  <ul className="mt-1 space-y-0.5">
                    {product.strengths.slice(0, 3).map((s: string, j: number) => (
                      <li key={j} className="text-[11px] text-[#aaa] flex gap-1"><span className="text-emerald-500 shrink-0">+</span>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {product.weaknesses?.length > 0 && (
                <div className="mt-2">
                  <p className="text-[9px] font-semibold text-[#888] uppercase">Faiblesses</p>
                  <ul className="mt-1 space-y-0.5">
                    {product.weaknesses.slice(0, 2).map((w: string, j: number) => (
                      <li key={j} className="text-[11px] text-[#aaa] flex gap-1"><span className="text-[#555] shrink-0">−</span>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Key differences (compact) */}
      {keyDiffs.length > 0 && (
        <div className="mt-4 rounded-xl bg-[#393E46] border border-[#393E46] overflow-hidden">
          <div className="px-3 py-2 border-b border-[#434850]">
            <h2 className="text-xs font-semibold text-white">Différences clés</h2>
          </div>
          <div className="divide-y divide-[#434850]">
            {keyDiffs.slice(0, 5).map((diff: any, i: number) => (
              <div key={i} className="px-3 py-2">
                <p className="text-[11px] font-medium text-white">{diff.spec}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {diff.values?.map((val: string, j: number) => (
                    <span key={j} className={`text-[11px] ${verdict.winner_index === j ? 'text-violet-300' : 'text-[#666]'}`}>
                      {clips[j]?.product_name?.split(' ')[0] || `P${j + 1}`}: {val}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ComparisonChat comparisonId={comparisonId} embedAccessToken={accessToken} />
    </div>
  )
}
