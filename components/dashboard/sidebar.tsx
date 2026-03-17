'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { ThemeToggle } from '@/components/theme-toggle'

const topNav = [
  { name: 'Dashboard', href: '/', icon: DashIcon },
  { name: 'Historique', href: '/historique', icon: HistoryIcon },
  { name: 'Produits', href: '/clips', icon: ProductIcon },
  { name: 'Projets', href: '/projects', icon: FolderIcon },
]

export function DashboardShell({
  user,
  children,
}: {
  user: User
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
  const avatarUrl = user.user_metadata?.avatar_url

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#F5F0E8] dark:bg-[#1a1a1e] text-gray-900 dark:text-white">
      {/* Menu horizontal en haut à droite */}
      <header className="shrink-0 z-40 border-b border-gray-200 dark:border-[#393E46] bg-[#F5F0E8] dark:bg-[#1a1a1e]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-red-500 flex items-center justify-center text-sm font-bold text-white">B</div>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">BriefAI</span>
          </Link>
          <nav className="flex items-center gap-1">
            {topNav.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                    isActive
                      ? 'bg-violet-100 dark:bg-[#393E46] text-violet-700 dark:text-white'
                      : 'text-gray-600 dark:text-[#888] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <item.icon active={isActive} />
                  {item.name}
                </Link>
              )
            })}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-500 dark:text-[#555] hidden sm:block truncate max-w-[120px]">{fullName}</span>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full shrink-0" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-[#434850] flex items-center justify-center text-xs font-medium text-gray-600 dark:text-[#888] shrink-0">
                {fullName[0].toUpperCase()}
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 dark:text-[#555] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a] rounded-lg transition-colors"
              title="Déconnexion"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 w-full max-w-5xl mx-auto flex flex-col px-4 overflow-hidden">
        <main className="flex-1 min-h-0 relative pb-16 overflow-auto">
          {children}
        </main>
      </div>

      {/* Settings en bas à gauche */}
      <Link
        href="/settings"
        className={`fixed bottom-5 left-5 z-20 flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-[#393E46] bg-[#F5F0E8] dark:bg-[#393E46] text-sm transition-colors ${
          pathname === '/settings'
            ? 'text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-500/50'
            : 'text-gray-600 dark:text-[#888] hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-[#3f3f46]'
        }`}
      >
        <SettingsIcon active={pathname === '/settings'} />
        Settings
      </Link>

      <ThemeToggle />
    </div>
  )
}

// ── Icons ──

const iconCls = (active: boolean) =>
  active ? 'text-violet-600 dark:text-white' : 'text-gray-500 dark:text-[#666]'

function HistoryIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-4 h-4 shrink-0 ${iconCls(active)}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function DashIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-4 h-4 shrink-0 ${iconCls(active)}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}

function ProductIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-4 h-4 shrink-0 ${iconCls(active)}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  )
}

function FolderIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-4 h-4 shrink-0 ${iconCls(active)}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  )
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-4 h-4 shrink-0 ${iconCls(active)}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
