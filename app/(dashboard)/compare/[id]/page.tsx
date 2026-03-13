import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ComparisonChat } from '@/components/comparison/chat'

interface PageProps { params: Promise<{ id: string }> }

export default async function ComparisonPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: comparison, error } = await supabase
    .from('comparisons')
    .select('id, status, model_used, result_analysis, created_at')
    .eq('id', id).eq('user_id', user!.id).single()

  if (error || !comparison) return notFound()

  const { data: clipLinks } = await supabase
    .from('comparison_clips').select('clip_id').eq('comparison_id', id)
  const clipIds = clipLinks?.map(l => l.clip_id) || []
  const { data: rawClips } = await supabase
    .from('clips')
    .select('id, product_name, brand, price, currency, rating, review_count, image_url, source_domain')
    .in('id', clipIds)
  const clips = clipIds.map(cid => rawClips?.find(c => c.id === cid)).filter(Boolean)

  const result = comparison.result_analysis as any

  if (comparison.status === 'pending') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto border-2 border-[#333] border-t-violet-500 rounded-full animate-spin" />
          <p className="mt-4 text-sm text-[#888]">Analyse en cours...</p>
        </div>
      </div>
    )
  }

  if (comparison.status === 'failed' || !result?.verdict) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
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

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <a href="/clips" className="text-sm text-[#888] hover:text-white transition-colors">← Retour</a>

      {/* Verdict */}
      <div className="mt-4 rounded-xl bg-[#25252a] border border-[#3a3a40] p-6">
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
                : 'Match serré'}
            </h1>
            <p className="mt-2 text-sm text-[#aaa] leading-relaxed">{verdict.summary}</p>
            <div className="mt-3 flex items-center gap-3">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                verdict.confidence >= 0.8 ? 'bg-emerald-500/10 text-emerald-400' :
                verdict.confidence >= 0.5 ? 'bg-amber-500/10 text-amber-400' :
                'bg-[#3a3a40] text-[#888]'
              }`}>
                Confiance : {Math.round(verdict.confidence * 100)}%
              </span>
              <span className="text-xs text-[#555]">{comparison.model_used}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Product insights */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.map((product: any, i: number) => {
          const clip = clips[i]
          const isWinner = verdict.winner_index === i
          return (
            <div key={i} className={`rounded-xl bg-[#18181B] border p-5 ${
              isWinner ? 'border-violet-500/50 ring-1 ring-violet-500/10' : 'border-[#3a3a40]'
            }`}>
              <div className="flex items-start gap-3">
                {clip?.image_url && (
                  <img src={clip.image_url} alt="" className="w-12 h-12 rounded-lg object-contain bg-[#25252a]" referrerPolicy="no-referrer" />
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
                          'bg-[#3a3a40] text-[#888]'
                        }`}>{rf.severity}</span>
                        {rf.issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-[#3a3a40] flex items-center justify-between text-xs">
                {product.value_for_money && (
                  <span className={`px-2 py-1 rounded-full font-medium ${
                    product.value_for_money === 'excellent' ? 'bg-emerald-500/10 text-emerald-400' :
                    product.value_for_money === 'good' ? 'bg-violet-500/10 text-violet-300' :
                    'bg-[#3a3a40] text-[#888]'
                  }`}>Q/P : {product.value_for_money}</span>
                )}
                {product.best_for && <span className="text-[#555] truncate ml-2">{product.best_for}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Key differences */}
      {keyDiffs.length > 0 && (
        <div className="mt-6 rounded-xl bg-[#25252a] border border-[#3a3a40] overflow-hidden">
          <div className="px-5 py-3 bg-[#25252a] border-b border-[#3a3a40]">
            <h2 className="text-sm font-semibold text-white">Différences clés</h2>
          </div>
          <div className="divide-y divide-[#2e2e33]">
            {keyDiffs.map((diff: any, i: number) => (
              <div key={i} className="px-5 py-3">
                <p className="text-sm font-medium text-white">{diff.spec}</p>
                <div className="mt-1.5 flex gap-4">
                  {diff.values?.map((val: string, j: number) => (
                    <span key={j} className={`text-sm ${verdict.winner_index === j ? 'text-violet-300' : 'text-[#666]'}`}>
                      {clips[j]?.product_name?.split(' ')[0] || `P${j+1}`}: {val}
                    </span>
                  ))}
                </div>
                {diff.insight && <p className="mt-1 text-xs text-[#555]">{diff.insight}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <ComparisonChat comparisonId={id} />
    </div>
  )
}
