'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { SumearWordmark } from '@/components/ui/sumear-wordmark'
import { SumearLogoBadge } from '@/components/ui/sumear-logo-badge'
import { useTheme } from '@/components/theme-provider'

const navItems = [
  { name: 'Dashboard', href: '/', icon: DashIcon },
  { name: 'Products', href: '/clips', icon: ProductIcon },
  { name: 'Projects', href: '/projects', icon: FolderIcon },
  { name: 'Chat', href: '/chat', icon: ChatIcon },
]

/** Pages where content fills full width (no max-width container). */
function isDashboardMainFullWidth(pathname: string | null): boolean {
  if (!pathname) return false
  if (/^\/projects\/[^/]+$/.test(pathname)) return true
  return false
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: 'var(--ds-bg-page)',
        overflow: 'hidden',
        fontFamily: 'var(--font-plus-jakarta-sans), sans-serif',
      }}
    >
      {/* ── Horizontal header — 3-column grid: logo | nav | user ── */}
      <header
        style={{
          height: 52,
          flexShrink: 0,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: '0 18px',
          background: 'var(--ds-bg-sidebar)',
          borderBottom: '0.5px solid var(--ds-border-07)',
        }}
      >
        {/* Left: logo */}
        <div style={{ justifySelf: 'start' }}>
          <Link
            href="/"
            style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
          >
            <SumearLogoBadge size={24} />
            <SumearWordmark size={19} />
          </Link>
        </div>

        {/* Centre: nav */}
        <nav style={{ justifySelf: 'center', display: 'flex', alignItems: 'center', gap: 144 }}>
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 11px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? 'var(--ds-text-primary)' : 'var(--ds-text-secondary)',
                  background: isActive ? 'var(--ds-bg-card)' : 'transparent',
                  transition: 'background 150ms, color 150ms',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--ds-bg-hover)'
                    e.currentTarget.style.color = 'var(--ds-text-primary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--ds-text-secondary)'
                  }
                }}
              >
                <item.icon active={isActive} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Right: settings icon + avatar + name + logout */}
        <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link
            href="/settings"
            title="Settings"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 8px',
              borderRadius: 8,
              color: settingsActive ? 'var(--ds-text-primary)' : 'var(--ds-text-secondary)',
              background: settingsActive ? 'var(--ds-bg-card)' : 'transparent',
              transition: 'background 150ms, color 150ms',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              if (!settingsActive) {
                e.currentTarget.style.background = 'var(--ds-bg-hover)'
                e.currentTarget.style.color = 'var(--ds-text-primary)'
              }
            }}
            onMouseLeave={(e) => {
              if (!settingsActive) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--ds-text-secondary)'
              }
            }}
          >
            <SettingsIcon active={settingsActive} />
          </Link>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--ds-accent-light)',
                color: 'var(--ds-text-tag)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
          )}
          <span style={{ fontSize: 13, color: 'var(--ds-text-secondary)', fontWeight: 500 }}>
            {firstName}
          </span>
          <button
            onClick={handleLogout}
            title="Log out"
            className="shrink-0 transition-opacity hover:opacity-60"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ds-text-muted)',
              display: 'flex',
              alignItems: 'center',
              padding: 4,
              borderRadius: 6,
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Scrollable main content ── */}
      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          background: 'var(--ds-bg-page)',
        }}
      >
        <div
          style={{
            paddingTop: 28,
            paddingLeft: 48,
            paddingRight: 40,
            paddingBottom: 80,
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

      {/* ── Theme toggle — fixed bottom-right, hidden on /settings (has its own) ── */}
      <div
        onClick={toggleTheme}
        title={theme === 'light' ? 'Dark mode' : 'Light mode'}
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

      {/* ── Footer — fixed, full width ── */}
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
            { label: 'terms', href: '/legal' },
            { label: 'privacy', href: '/privacy' },
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

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-[18px] h-[18px] shrink-0 ${iconCls(active)}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
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
    <svg
      className={`w-[15px] h-[15px] shrink-0 ${iconCls(active)}`}
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="2"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2"/>
    </svg>
  )
}
