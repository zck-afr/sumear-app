'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { SumearWordmark } from '@/components/ui/sumear-wordmark'
import { SumearLogoBadge } from '@/components/ui/sumear-logo-badge'
import { useTheme } from '@/components/theme-provider'

const navItems = [
  { name: 'Tableau de bord', href: '/', icon: DashIcon },
  { name: 'Projets', href: '/projects', icon: FolderIcon },
  { name: 'Mes produits', href: '/clips', icon: ProductIcon },
  { name: 'Historique', href: '/historique', icon: HistoryIcon },
]

/** Même colonne centrée que la page d’accueil (max 860px). Exclut la fiche projet (contenu + chat 400px). */
function isDashboardMainFullWidth(pathname: string | null): boolean {
  if (!pathname) return false
  return /^\/projects\/[^/]+$/.test(pathname)
}

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
  const firstName = fullName.split(' ')[0]
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const avatarUrl = user.user_metadata?.avatar_url
  const settingsActive = pathname === '/settings'

  const { theme, setTheme } = useTheme()

  function toggleTheme() {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <div className="flex" style={{ background: 'var(--ds-bg-page)' }}>

      {/* ── Sidebar ── */}
      <aside
        className="hidden lg:flex w-[200px] shrink-0 flex-col sticky top-0"
        style={{
          background: 'var(--ds-bg-sidebar)',
          borderRight: '0.5px solid var(--ds-border-07)',
          zoom: 1.265,
          height: 'calc((100vh - 45px) / 1.265)',
          justifyContent: 'space-between',
        }}
      >
        {/* Top group: logo + nav */}
        <div>
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-[10px] shrink-0"
            style={{ padding: '18px 14px', marginBottom: 40 }}
          >
            <SumearLogoBadge size={24} />
            <SumearWordmark size={19} />
          </Link>

          {/* Nav items */}
          <nav className="flex flex-col" style={{ padding: '0 14px', gap: 14 }}>
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-[10px] rounded-[12px] text-[14px] transition-colors ${
                    isActive
                      ? 'bg-[var(--ds-bg-card)] text-[var(--ds-text-primary)] font-medium'
                      : 'text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-hover)]'
                  }`}
                  style={{ padding: '10px 12px' }}
                >
                  <item.icon active={isActive} />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Bottom: Paramètres only */}
        <div style={{ padding: '14px 14px 20px' }}>
          <Link
            href="/settings"
            className={`flex items-center gap-[10px] rounded-[12px] text-[14px] transition-colors ${
              settingsActive
                ? 'bg-[var(--ds-bg-card)] text-[var(--ds-text-primary)] font-medium'
                : 'text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-hover)]'
            }`}
            style={{ padding: '10px 12px' }}
          >
            <SettingsIcon active={settingsActive} />
            Paramètres
          </Link>
        </div>
      </aside>

      {/* ── Mobile top bar (below lg) ── */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14"
        style={{ background: 'var(--ds-bg-sidebar)', borderBottom: '0.5px solid var(--ds-border-07)' }}
      >
        <Link href="/" className="flex items-center gap-2">
          <div
            className="flex items-center justify-center"
            style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--ds-accent)' }}
          >
            <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
              <path d="M5 0.8C3.07 0.8 1.5 2.37 1.5 4.3c0 1.18.59 2.22 1.49 2.86V8c0 .28.22.5.5.5h3.02a.5.5 0 00.5-.5V7.16C7.91 6.52 8.5 5.48 8.5 4.3 8.5 2.37 6.93.8 5 .8z" fill="white" />
              <rect x="3.35" y="8.4" width="3.3" height=".8" rx=".4" fill="white" />
            </svg>
          </div>
          <SumearWordmark size={17} />
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`p-2 rounded-[10px] transition-colors ${
                  isActive ? 'bg-[var(--ds-bg-card)] text-[var(--ds-text-primary)]' : 'text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-hover)]'
                }`}
              >
                <item.icon active={isActive} />
              </Link>
            )
          })}
        </nav>
      </div>

      {/* ── Main content ── */}
      <main
        className="flex-1 min-w-0 lg:pt-0 pt-14"
        style={{ background: 'var(--ds-bg-page)' }}
      >
        {/* Top-right: user name + logout */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 28px 0', zoom: 1.21 }}>
          <div className="flex items-center" style={{ gap: 10 }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="shrink-0 rounded-full object-cover" style={{ width: 28, height: 28 }} referrerPolicy="no-referrer" />
            ) : (
              <div className="flex items-center justify-center shrink-0 rounded-full" style={{ width: 28, height: 28, background: 'var(--ds-accent-light)', color: 'var(--ds-text-tag)', fontSize: 12, fontWeight: 500 }}>
                {initials}
              </div>
            )}
            <span style={{ fontSize: 13, color: 'var(--ds-text-secondary)', fontWeight: 500 }}>{firstName}</span>
            <button
              onClick={handleLogout}
              className="shrink-0 transition-opacity hover:opacity-60"
              style={{ color: 'var(--ds-text-muted)' }}
              title="Déconnexion"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>

        <div
          style={{
            paddingTop: 28,
            paddingLeft: 48,
            paddingRight: 40,
            paddingBottom: 40,
            zoom: 1.21,
          }}
        >
          {isDashboardMainFullWidth(pathname) ? (
            children
          ) : (
            <div style={{ maxWidth: 860, margin: '0 auto', width: '100%' }}>
              {children}
            </div>
          )}
        </div>
      </main>

      {/* ── Toggle — fixed bottom-right, above footer ── hidden on /settings (has its own toggle) */}
      <div
        onClick={toggleTheme}
        title={theme === 'light' ? 'Mode sombre' : 'Mode clair'}
        style={{
          position: 'fixed',
          bottom: 58,
          right: 28,
          zIndex: 20,
          display: pathname === '/settings' ? 'none' : 'flex',
          width: 56,
          height: 28,
          borderRadius: 20,
          background: 'var(--ds-bg-hover)',
          border: '0.5px solid var(--ds-border-12)',
          alignItems: 'center',
          padding: 3,
          cursor: 'pointer',
          transition: 'background .2s',
          boxShadow: '0 2px 12px rgba(0,0,0,.1)',
        }}
      >
        <div style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'var(--ds-bg-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform .2s',
          transform: theme === 'dark' ? 'translateX(28px)' : 'translateX(0)',
          flexShrink: 0,
        }}>
          {theme === 'light' ? (
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M 10 3 A 7 7 0 1 0 17 10 A 5 5 0 1 1 10 3 Z"
                stroke="var(--ds-text-muted)" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="2.5" stroke="var(--ds-accent)" strokeWidth="1.5" />
              <line x1="11" y1="7" x2="12.5" y2="7" stroke="var(--ds-accent)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="9.83" y1="9.83" x2="10.89" y2="10.89" stroke="var(--ds-accent)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="7" y1="11" x2="7" y2="12.5" stroke="var(--ds-accent)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="4.17" y1="9.83" x2="3.11" y2="10.89" stroke="var(--ds-accent)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="3" y1="7" x2="1.5" y2="7" stroke="var(--ds-accent)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="4.17" y1="4.17" x2="3.11" y2="3.11" stroke="var(--ds-accent)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="7" y1="3" x2="7" y2="1.5" stroke="var(--ds-accent)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="9.83" y1="4.17" x2="10.89" y2="3.11" stroke="var(--ds-accent)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </div>
      </div>

      {/* ── Footer — fixed, full width, above all content ── */}
      <footer
        className="flex items-center justify-between"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          pointerEvents: 'none',
          background: 'var(--ds-footer-bg)',
          padding: '14px 40px',
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,.7)',
            fontFamily: 'var(--font-plus-jakarta-sans), sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            pointerEvents: 'none',
          }}
        >
          <SumearWordmark size={11} darkBg />
          <span>· 2026</span>
        </span>
        <div className="flex items-center" style={{ gap: 24, pointerEvents: 'auto' }}>
          {[
            { label: 'conditions générales', href: '/legal' },
            { label: 'confidentialité', href: '/privacy' },
            { label: 'sumear.app', href: 'https://sumear.app' },
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', textDecoration: 'none' }}
              className="hover:text-white transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      </footer>

    </div>
  )
}

// ── Icons ────────────────────────────────────────────────────────────────────

const iconCls = (active: boolean) =>
  active ? 'text-[var(--ds-text-primary)]' : 'text-[var(--ds-text-secondary)]'

function DashIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-[18px] h-[18px] shrink-0 ${iconCls(active)}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}

function HistoryIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-[18px] h-[18px] shrink-0 ${iconCls(active)}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ProductIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-[18px] h-[18px] shrink-0 ${iconCls(active)}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  )
}

function FolderIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-[18px] h-[18px] shrink-0 ${iconCls(active)}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  )
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-[18px] h-[18px] shrink-0 ${iconCls(active)}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
