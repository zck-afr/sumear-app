import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ComparisonPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch comparison with linked clips
  const { data: comparison, error } = await supabase
    .from('comparisons')
    .select('id, status, model_used, api_cost_usd, result_analysis, created_at')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (error || !comparison) return notFound()

  // Fetch linked clips
  const { data: clipLinks } = await supabase
    .from('comparison_clips')
    .select('clip_id')
    .eq('comparison_id', id)

  const clipIds = clipLinks?.map(l => l.clip_id) || []

  const { data: rawClips } = await supabase
    .from('clips')
    .select('id, product_name, brand, price, currency, rating, review_count, image_url, source_domain')
    .in('id', clipIds)

  // Sort clips to match the order of clipIds (which matches the LLM prompt order)
  const clips = clipIds
    .map(id => rawClips?.find(c => c.id === id))
    .filter(Boolean)

  const result = comparison.result_analysis as any

  if (comparison.status === 'pending') {
    return (
      <div className="text-center py-20">
        <div className="mx-auto w-10 h-10 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        <p className="mt-4 text-sm text-gray-500">Analyse en cours...</p>
      </div>
    )
  }

  if (comparison.status === 'failed' || !result?.verdict) {
    return (
      <div className="text-center py-20">
        <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xl font-bold">✗</div>
        <p className="mt-4 text-sm text-gray-600">L&apos;analyse a échoué. Réessayez.</p>
      </div>
    )
  }

  const verdict = result.verdict
  const products = result.products || []
  const keyDifferences = result.key_differences || []

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <a href="/clips" className="text-sm text-gray-500 hover:text-gray-700">← Retour aux clips</a>

      {/* ── Layer 1: Verdict ── */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
            verdict.is_clear_winner ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {verdict.is_clear_winner ? '🏆' : '⚖️'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {verdict.winner_index != null && clips?.[verdict.winner_index]
                ? `${clips[verdict.winner_index].product_name} l'emporte`
                : 'Match serré'
              }
            </h1>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">{verdict.summary}</p>
            <div className="mt-3 flex items-center gap-3">
              <ConfidenceBadge confidence={verdict.confidence} />
              <span className="text-xs text-gray-400">
                {comparison.model_used} · {new Date(comparison.created_at).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Layer 2: Product Insights ── */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {products.map((product: any, i: number) => {
          const clip = clips?.[i]
          const isWinner = verdict.winner_index === i
          return (
            <div key={i} className={`rounded-xl border bg-white p-5 ${isWinner ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-gray-200'}`}>
              {/* Header */}
              <div className="flex items-start gap-3">
                {clip?.image_url && (
                  <img src={clip.image_url} alt="" className="w-14 h-14 rounded-lg object-contain bg-gray-50" referrerPolicy="no-referrer" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{product.name || clip?.product_name}</p>
                    {isWinner && <span className="shrink-0 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Meilleur choix</span>}
                  </div>
                  {clip && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {clip.price != null && `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: clip.currency || 'EUR' }).format(clip.price)} · `}
                      {clip.source_domain}
                    </p>
                  )}
                </div>
              </div>

              {/* Strengths */}
              {product.strengths?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Forces</p>
                  <ul className="mt-1.5 space-y-1">
                    {product.strengths.map((s: string, j: number) => (
                      <li key={j} className="text-sm text-gray-600 flex gap-2">
                        <span className="text-emerald-500 shrink-0">+</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weaknesses */}
              {product.weaknesses?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Faiblesses</p>
                  <ul className="mt-1.5 space-y-1">
                    {product.weaknesses.map((w: string, j: number) => (
                      <li key={j} className="text-sm text-gray-600 flex gap-2">
                        <span className="text-gray-400 shrink-0">−</span> {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Red flags */}
              {product.red_flags?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Alertes</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {product.red_flags.map((rf: any, j: number) => (
                      <li key={j} className="text-sm">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-1.5 ${
                          rf.severity === 'high' ? 'bg-red-100 text-red-700' :
                          rf.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {rf.severity === 'high' ? '🔴' : rf.severity === 'medium' ? '🟡' : '⚪'} {rf.severity}
                        </span>
                        <span className="text-gray-700">{rf.issue}</span>
                        {rf.evidence && <span className="text-gray-400 text-xs block mt-0.5 ml-6">{rf.evidence}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Value + Best for */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                {product.value_for_money && (
                  <span className={`px-2 py-1 rounded-full font-medium ${
                    product.value_for_money === 'excellent' ? 'bg-emerald-50 text-emerald-700' :
                    product.value_for_money === 'good' ? 'bg-blue-50 text-blue-700' :
                    product.value_for_money === 'average' ? 'bg-gray-100 text-gray-600' :
                    'bg-red-50 text-red-600'
                  }`}>
                    Rapport Q/P : {product.value_for_money}
                  </span>
                )}
                {product.best_for && (
                  <span className="text-gray-400 truncate ml-2">Idéal pour : {product.best_for}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Layer 3: Key Differences ── */}
      {keyDifferences.length > 0 && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Différences clés</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {keyDifferences.map((diff: any, i: number) => (
              <div key={i} className="px-5 py-3">
                <p className="text-sm font-medium text-gray-900">{diff.spec}</p>
                <div className="mt-1.5 flex gap-4">
                  {diff.values?.map((val: string, j: number) => (
                    <span key={j} className={`text-sm ${
                      verdict.winner_index === j ? 'text-emerald-700 font-medium' : 'text-gray-500'
                    }`}>
                      {clips?.[j]?.product_name?.split(' ')[0] || `Produit ${j + 1}`}: {val}
                    </span>
                  ))}
                </div>
                {diff.insight && (
                  <p className="mt-1 text-xs text-gray-400">{diff.insight}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color = pct >= 80 ? 'bg-emerald-100 text-emerald-700' :
                pct >= 50 ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-600'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      Confiance : {pct}%
    </span>
  )
}
