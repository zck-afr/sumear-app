import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'là'

  // Get real counts
  const { count: clipsCount } = await supabase
    .from('clips')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const { count: projectsCount } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const now = new Date()
  const { data: usage } = await supabase
    .from('usage')
    .select('clips_count, comparisons_count')
    .eq('user_id', user!.id)
    .eq('year', now.getFullYear())
    .eq('month', now.getMonth() + 1)
    .single()

  const monthlyClips = usage?.clips_count ?? 0
  const monthlyComparisons = usage?.comparisons_count ?? 0

  // Get recent clips for preview
  const { data: recentClips } = await supabase
    .from('clips')
    .select('id, product_name, brand, source_domain, image_url, price, currency, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(6)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">
        Bonjour {firstName} 👋
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Bienvenue sur BriefAI. Clipez des produits avec l&apos;extension Chrome, puis comparez-les ici.
      </p>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Clips ce mois" value={String(monthlyClips)} subtitle="sur 20 (Free)" />
        <StatCard title="Analyses ce mois" value={String(monthlyComparisons)} subtitle="sur 5 (Free)" />
        <StatCard title="Projets" value={String(projectsCount ?? 0)} subtitle="sur 3 (Free)" />
      </div>

      {/* Recent clips or empty state */}
      {(!recentClips || recentClips.length === 0) ? (
        <div className="mt-12 text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
          </svg>
          <h3 className="mt-4 text-sm font-semibold text-gray-900">Aucun clip</h3>
          <p className="mt-1 text-sm text-gray-500">
            Installez l&apos;extension Chrome pour commencer à clipper des produits.
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Clips récents</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentClips.map((clip) => (
              <div key={clip.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
                {clip.image_url ? (
                  <img
                    src={clip.image_url}
                    alt=""
                    className="h-12 w-12 rounded object-contain bg-gray-50"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center text-gray-300">📦</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{clip.product_name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{clip.source_domain}</span>
                    {clip.price != null && (
                      <span className="font-semibold text-emerald-600">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: clip.currency || 'EUR' }).format(clip.price)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{subtitle}</p>
    </div>
  )
}
