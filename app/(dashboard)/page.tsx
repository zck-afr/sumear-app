import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { RecentClipsGrid } from '@/components/dashboard/recent-clips-grid'

export default async function DashboardHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'

  // Fetch stats
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { count: clipsCount } = await supabase
    .from('clips')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const { count: comparisonsCount } = await supabase
    .from('comparisons')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)
    .gte('created_at', monthStart)

  // Fetch recent clips
  const { data: recentClips } = await supabase
    .from('clips')
    .select('id, product_name, brand, price, currency, image_url, source_domain, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(6)

  const analysesLimit = 5 // Free plan

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      {/* Greeting — plus bas */}
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-16">
        Hey {firstName} <span className="opacity-60">:)</span>
      </h1>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Products absorbed */}
        <div className="rounded-xl bg-[#F5F0E8] dark:bg-[#393E46] border-2 border-gray-300 dark:border-[#393E46] shadow-sm dark:shadow-none p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-[#888] font-medium">Produits absorbés</span>
            <svg className="w-4 h-4 text-gray-400 dark:text-[#555]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">{clipsCount ?? 0}</p>
          <div className="mt-3 h-[2px] bg-gray-200 dark:bg-[#393E46] rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min((clipsCount ?? 0) * 5, 100)}%` }} />
          </div>
        </div>

        {/* Analyses remaining */}
        <div className="rounded-xl bg-[#F5F0E8] dark:bg-[#393E46] border-2 border-gray-300 dark:border-[#393E46] shadow-sm dark:shadow-none p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-[#888] font-medium">Analyses restantes</span>
            <svg className="w-4 h-4 text-gray-400 dark:text-[#555]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">
            {Math.max(analysesLimit - (comparisonsCount ?? 0), 0)}<span className="text-lg text-gray-500 dark:text-[#555]">/{analysesLimit}</span>
          </p>
          <div className="mt-3 h-[2px] bg-gray-200 dark:bg-[#393E46] rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${((comparisonsCount ?? 0) / analysesLimit) * 100}%` }} />
          </div>
        </div>

        {/* Money saved */}
        <div className="rounded-xl bg-[#F5F0E8] dark:bg-[#393E46] border-2 border-gray-300 dark:border-[#393E46] shadow-sm dark:shadow-none p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-[#888] font-medium">Argent économisé</span>
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          </div>
          <p className="mt-3 text-3xl font-bold text-emerald-600 dark:text-emerald-400">—</p>
          <p className="mt-2 text-xs text-gray-500 dark:text-[#555]">Disponible après votre 1ère comparaison</p>
        </div>
      </div>

      {/* Recent products */}
      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Produits récents</h2>
          <Link href="/clips" className="text-xs text-violet-500 hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300 transition-colors">
            Voir plus
          </Link>
        </div>

        {(!recentClips || recentClips.length === 0) ? (
          <div className="mt-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-[#393E46] bg-[#F5F0E8] dark:bg-transparent shadow-sm dark:shadow-none p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-[#555]">Aucun produit encore. Utilisez l&apos;extension Chrome pour clipper des produits.</p>
          </div>
        ) : (
          <RecentClipsGrid clips={recentClips} />
        )}
      </div>

    </div>
  )
}
