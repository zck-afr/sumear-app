import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'là'

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">
        Bonjour {firstName} 👋
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Bienvenue sur BriefAI. Clipez des produits avec l&apos;extension Chrome, puis comparez-les ici.
      </p>

      {/* Quick stats */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Clips ce mois" value="0" subtitle="sur 20 (Free)" />
        <StatCard title="Analyses ce mois" value="0" subtitle="sur 5 (Free)" />
        <StatCard title="Projets" value="0" subtitle="sur 3 (Free)" />
      </div>

      {/* Empty state */}
      <div className="mt-12 text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
        <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
        </svg>
        <h3 className="mt-4 text-sm font-semibold text-gray-900">Aucun clip</h3>
        <p className="mt-1 text-sm text-gray-500">
          Installez l&apos;extension Chrome pour commencer à clipper des produits.
        </p>
      </div>
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
