'use client'

// ============================================================================
// ChatLayoutShell — full-viewport shell for /chat.
// Replaces the dashboard sidebar with a compact horizontal header, then
// gives all remaining vertical space to the chat sub-sidebar + thread.
//
// Uses the same SumearLogoBadge + SumearWordmark as the sidebar so the
// brand identity is identical.
// ============================================================================

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SumearLogoBadge } from '@/components/ui/sumear-logo-badge'
import { SumearWordmark } from '@/components/ui/sumear-wordmark'

const FOOTER_LINKS = [
  { label: 'terms', href: '/legal' },
  { label: 'privacy', href: '/privacy' },
  { label: 'sumear.app', href: 'https://sumear.app' },
]

const HEADER_H = 52 // px — compact, matches sidebar logo row height

const navItems = [
  { name: 'Dashboard', href: '/', icon: DashIcon },
  { name: 'Products', href: '/clips', icon: ProductIcon },
  { name: 'Projects', href: '/projects', icon: FolderIcon },
  { name: 'Chat', href: '/chat', icon: ChatIcon },
]

export function ChatLayoutShell({
  name,
  avatarUrl,
  children,
}: {
  name: string
  avatarUrl: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

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
      {/* ── Horizontal header — 3-column grid: logo | nav | avatar ── */}
      <header
        style={{
          height: HEADER_H,
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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
            }}
          >
            <SumearLogoBadge size={24} />
            <SumearWordmark size={19} />
          </Link>
        </div>

        {/* Centre: nav — always centred relative to the viewport */}
        <nav
          style={{
            justifySelf: 'center',
            display: 'flex',
            alignItems: 'center',
            gap: 144,
          }}
        >
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
                  color: isActive
                    ? 'var(--ds-text-primary)'
                    : 'var(--ds-text-secondary)',
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

        {/* Right: user avatar */}
        <div
          style={{
            justifySelf: 'end',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
              }}
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
          <span
            style={{
              fontSize: 13,
              color: 'var(--ds-text-secondary)',
              fontWeight: 500,
            }}
          >
            {name.split(' ')[0]}
          </span>
        </div>
      </header>

      {/* ── Main area (sub-sidebar + thread fill the rest) ── */}
      <main
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {children}
      </main>

      {/* ── Footer — flow element so it doesn't overlap the Composer ── */}
      <footer
        style={{
          flexShrink: 0,
          pointerEvents: 'none',
          background: 'var(--ds-footer-bg)',
          padding: '10px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, pointerEvents: 'auto' }}>
          {FOOTER_LINKS.map(({ label, href }) => (
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

// ── Icons (same style as sidebar.tsx — inline SVG, theme-aware via currentColor) ─

const iconCls = (active: boolean) =>
  active ? 'var(--ds-text-primary)' : 'var(--ds-text-secondary)'

function DashIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={iconCls(active)} style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}

function ProductIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={iconCls(active)} style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  )
}

function FolderIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={iconCls(active)} style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  )
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={iconCls(active)} style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
    </svg>
  )
}
