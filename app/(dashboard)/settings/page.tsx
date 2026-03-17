import { createClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user!.id)
    .single()

  const plan = profile?.plan || 'free'

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white">Settings</h1>
      <p className="mt-1 text-sm text-[#888]">Gérez votre compte et vos préférences.</p>

      {/* Account */}
      <div className="mt-8 rounded-xl bg-[#393E46] border border-[#393E46] p-5">
        <h2 className="text-sm font-semibold text-white">Compte</h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#888]">Email</span>
            <span className="text-sm text-white">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#888]">Nom</span>
            <span className="text-sm text-white">{user?.user_metadata?.full_name || '—'}</span>
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="mt-4 rounded-xl bg-[#393E46] border border-[#393E46] p-5">
        <h2 className="text-sm font-semibold text-white">Plan</h2>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <span className="text-sm text-white capitalize">{plan}</span>
            <p className="text-xs text-[#555] mt-1">
              {plan === 'free' ? '5 analyses / mois · 20 clips / mois' : 'Illimité'}
            </p>
          </div>
          <button className="px-4 py-2 text-xs font-semibold text-violet-400 border border-violet-500/30 rounded-lg hover:bg-violet-500/10 transition-colors">
            Upgrader
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="mt-4 rounded-xl bg-[#18181B] border border-red-500/20 p-5">
        <h2 className="text-sm font-semibold text-red-400">Zone dangereuse</h2>
        <p className="mt-2 text-xs text-[#666]">La suppression du compte est irréversible.</p>
        <button className="mt-3 px-4 py-2 text-xs font-semibold text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors">
          Supprimer mon compte
        </button>
      </div>
    </div>
  )
}
