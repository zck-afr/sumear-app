import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ sourceUrl?: string; comparisonId?: string }>
}

export default async function AnalysePage({ searchParams }: PageProps) {
  const { sourceUrl, comparisonId } = await searchParams

  if (!comparisonId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-6">
        <div className="text-center">
          <p className="text-[#888]">ID d&apos;analyse manquant.</p>
          <Link href="/clips" className="mt-4 inline-block text-sm text-violet-400 hover:underline">
            ← Retour aux produits
          </Link>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: comparison, error } = await supabase
    .from('comparisons')
    .select('id, status, model_used, result_analysis, created_at')
    .eq('id', comparisonId)
    .eq('user_id', user.id)
    .single()

  if (error || !comparison) return notFound()

  const { data: clipLinks } = await supabase
    .from('comparison_clips')
    .select('clip_id')
    .eq('comparison_id', comparisonId)
  const clipIds = clipLinks?.map((l) => l.clip_id) || []
  const { data: rawClips } = await supabase
    .from('clips')
    .select('id, product_name, brand, price, currency, rating, review_count, image_url, source_domain')
    .in('id', clipIds)
  const clips = clipIds.map((cid) => rawClips?.find((c) => c.id === cid)).filter(Boolean)

  const result = comparison.result_analysis as any
  const safeSourceUrl = sourceUrl && sourceUrl.startsWith('http') ? sourceUrl : null

  return (
    <div className="fixed inset-0 top-14 flex flex-col lg:flex-row bg-[#1a1a1e]">
      {/* Left: page produit (iframe) */}
      <div className="w-full lg:w-1/2 h-[40vh] lg:h-full flex flex-col border-b lg:border-b-0 lg:border-r border-[#393E46]">
        <div className="shrink-0 px-3 py-2 border-b border-[#393E46] flex items-center justify-between gap-2">
          <span className="text-xs text-[#888] truncate">
            {safeSourceUrl ? 'Page produit' : 'Aucune page associée'}
          </span>
          {safeSourceUrl && (
            <a
              href={safeSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-violet-400 hover:underline shrink-0"
            >
              Ouvrir dans un onglet
            </a>
          )}
        </div>
        <div className="flex-1 min-h-0 bg-[#111]">
          {safeSourceUrl ? (
            <iframe
              src={safeSourceUrl}
              title="Page produit"
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-[#555] text-sm">
              Ouvrez l&apos;extension sur une page produit puis cliquez sur &quot;Analyser&quot;.
            </div>
          )}
        </div>
      </div>

      {/* Right: résultat IA */}
      <div className="w-full lg:w-1/2 h-[60vh] lg:h-full overflow-y-auto">
        <AnalysisPanel
          comparison={comparison}
          result={result}
          clips={clips}
        />
      </div>
    </div>
  )
}

function AnalysisPanel({
  comparison,
  result,
  clips,
}: {
  comparison: { status: string; model_used: string | null; result_analysis: unknown }
  result: any
  clips: Array<{ id: string; product_name: string; brand: string | null; price: number | null; currency: string; rating: number | null; review_count: number | null; image_url: string | null; source_domain: string } | undefined>
}) {
  if (comparison.status === 'pending') {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto border-2 border-[#333] border-t-violet-500 rounded-full animate-spin" />
          <p className="mt-4 text-sm text-[#888]">Analyse en cours...</p>
        </div>
      </div>
    )
  }

  if (comparison.status === 'failed' || !result?.verdict) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-xl">✗</div>
          <p className="mt-4 text-sm text-[#888]">L&apos;analyse a échoué.</p>
          <Link href="/clips" className="mt-4 inline-block text-sm text-violet-400 hover:underline">
            ← Retour aux produits
          </Link>
        </div>
      </div>
    )
  }

  const verdict = result.verdict
  const products = result.products || []
  const keyDiffs = result.key_differences || []

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link href="/clips" className="text-sm text-[#888] hover:text-white transition-colors">← Retour aux produits</Link>

      <div className="mt-4 rounded-xl bg-[#393E46] border border-[#393E46] p-6">
        <div className="flex items-start gap-4">
          <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-lg ${
            verdict.is_clear_winner ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
          }`}>
            {verdict.is_clear_winner ? '🏆' : '⚖️'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              {verdict.winner_index != null && clips[verdict.winner_index]
                ? `${clips[verdict.winner_index]!.product_name} l'emporte`
                : products.length === 1 ? 'Analyse du produit' : 'Match serré'}
            </h1>
            <p className="mt-2 text-sm text-[#aaa] leading-relaxed">{verdict.summary}</p>
            <div className="mt-3 flex items-center gap-3">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                verdict.confidence >= 0.8 ? 'bg-emerald-500/10 text-emerald-400' :
                verdict.confidence >= 0.5 ? 'bg-amber-500/10 text-amber-400' :
                'bg-[#434850] text-[#888]'
              }`}>
                Confiance : {Math.round(verdict.confidence * 100)}%
              </span>
              {comparison.model_used && (
                <span className="text-xs text-[#555]">{comparison.model_used}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {products.map((product: any, i: number) => {
          const clip = clips[i]
          const isWinner = verdict.winner_index === i
          return (
            <div
              key={i}
              className={`rounded-xl bg-[#393E46] border p-5 ${
                isWinner ? 'border-violet-500/50 ring-1 ring-violet-500/10' : 'border-[#393E46]'
              }`}
            >
              <div className="flex items-start gap-3">
                {clip?.image_url && (
                  <img src={clip.image_url} alt="" className="w-12 h-12 rounded-lg object-contain bg-[#393E46]" referrerPolicy="no-referrer" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">{product.name || clip?.product_name}</p>
                    {isWinner && <span className="shrink-0 text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">Meilleur</span>}
                  </div>
                  {clip && (
                    <p className="text-xs text-[#666] mt-0.5">
                      {clip.price != null && `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: clip.currency || 'EUR' }).format(clip.price)} · `}
                      {clip.source_domain}
                    </p>
                  )}
                </div>
              </div>

              {product.strengths?.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Forces</p>
                  <ul className="mt-1.5 space-y-1">
                    {product.strengths.map((s: string, j: number) => (
                      <li key={j} className="text-sm text-[#aaa] flex gap-2"><span className="text-emerald-500 shrink-0">+</span>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {product.weaknesses?.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-semibold text-[#888] uppercase tracking-wider">Faiblesses</p>
                  <ul className="mt-1.5 space-y-1">
                    {product.weaknesses.map((w: string, j: number) => (
                      <li key={j} className="text-sm text-[#aaa] flex gap-2"><span className="text-[#555] shrink-0">−</span>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {product.red_flags?.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Alertes</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {product.red_flags.map((rf: any, j: number) => (
                      <li key={j} className="text-sm text-[#aaa]">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-1 ${
                          rf.severity === 'high' ? 'bg-red-500/10 text-red-400' :
                          rf.severity === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-[#434850] text-[#888]'
                        }`}>{rf.severity}</span>
                        {rf.issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-[#393E46] flex items-center justify-between text-xs">
                {product.value_for_money && (
                  <span className={`px-2 py-1 rounded-full font-medium ${
                    product.value_for_money === 'excellent' ? 'bg-emerald-500/10 text-emerald-400' :
                    product.value_for_money === 'good' ? 'bg-violet-500/10 text-violet-300' :
                    'bg-[#434850] text-[#888]'
                  }`}>Q/P : {product.value_for_money}</span>
                )}
                {product.best_for && <span className="text-[#555] truncate ml-2">{product.best_for}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {keyDiffs.length > 0 && (
        <div className="mt-6 rounded-xl bg-[#393E46] border border-[#393E46] overflow-hidden">
          <div className="px-5 py-3 bg-[#393E46] border-b border-[#393E46]">
            <h2 className="text-sm font-semibold text-white">Différences clés</h2>
          </div>
          <div className="divide-y divide-[#434850]">
            {keyDiffs.map((diff: any, i: number) => (
              <div key={i} className="px-5 py-3">
                <p className="text-sm font-medium text-white">{diff.spec}</p>
                <div className="mt-1.5 flex gap-4">
                  {diff.values?.map((val: string, j: number) => (
                    <span key={j} className={`text-sm ${verdict.winner_index === j ? 'text-violet-300' : 'text-[#666]'}`}>
                      {clips[j]?.product_name?.split(' ')[0] || `P${j + 1}`}: {val}
                    </span>
                  ))}
                </div>
                {diff.insight && <p className="mt-1 text-xs text-[#555]">{diff.insight}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
