// app/[lang]/login/page.tsx
// ─────────────────────────────────────────────
// Two-panel login page: branded gradient panel on the left (hidden on mobile),
// Google sign-in form on the right. OAuth handler is delegated to the
// existing /callback route — we don't touch any auth logic here.
// ─────────────────────────────────────────────

import Link from 'next/link'
import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import type { Locale } from '@/lib/i18n/config'
import { GoogleButton } from './google-button'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  const dict = await getDictionary(lang as Locale)
  return {
    title: `${dict.login.title} — Sumear`,
    description: dict.login.subtitle,
    robots: { index: false, follow: false },
  }
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang: langStr } = await params
  const lang = langStr as Locale
  const dict = await getDictionary(lang)
  const t = dict.login

  return (
    <div
      style={{
        height: '100vh',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        background: 'var(--bg-page)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
      }}
      className="sumear-login-grid"
    >
      {/* ── Left: brand panel ── */}
      <aside
        className="sumear-login-brand"
        style={{
          background: 'linear-gradient(160deg, #C8A882 0%, #B8715A 100%)',
          padding: '44px 48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
          color: '#fff',
        }}
      >
        {/* Top: logo row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: 'rgba(255,255,255,.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="2" y="3" width="10" height="1.2" rx="0.6" fill="#fff" />
              <rect x="2" y="5.6" width="10" height="1.2" rx="0.6" fill="#fff" />
              <rect x="2" y="8.2" width="10" height="1.2" rx="0.6" fill="#fff" />
              <rect x="2" y="10.8" width="10" height="1.2" rx="0.6" fill="#fff" />
            </svg>
          </span>
          <span
            style={{
              fontFamily: 'var(--font-playfair-display), Playfair Display, serif',
              fontSize: 18,
              marginLeft: 8,
              color: '#fff',
              letterSpacing: '-.2px',
            }}
          >
            sumear
          </span>
        </div>

        {/* Middle: headline + tagline */}
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-fraunces), Fraunces, serif',
              fontWeight: 300,
              fontStyle: 'italic',
              fontSize: 34,
              lineHeight: 1.2,
              color: '#fff',
              margin: 0,
            }}
          >
            <span style={{ display: 'block' }}>{t.headlineL1}</span>
            <span style={{ display: 'block' }}>{t.headlineL2}</span>
          </h1>
          <p
            style={{
              marginTop: 10,
              fontSize: 14,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,.65)',
              fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
              maxWidth: 420,
            }}
          >
            {t.tagline}
          </p>
        </div>

        {/* Bottom: footer */}
        <div
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,.4)',
            fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
          }}
        >
          sumear.app · 2026
        </div>
      </aside>

      {/* ── Right: login form ── */}
      <section
        style={{
          background: 'var(--bg-page)',
          padding: '44px 48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-fraunces), Fraunces, serif',
              fontWeight: 300,
              fontStyle: 'italic',
              fontSize: 28,
              color: 'var(--text-primary)',
              letterSpacing: '-.3px',
              margin: 0,
              marginBottom: 6,
            }}
          >
            {t.title}
          </h2>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              marginTop: 0,
              marginBottom: 32,
              fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
            }}
          >
            {t.subtitle}
          </p>

          <GoogleButton dict={t} />

          <p
            style={{
              marginTop: 16,
              fontSize: 11,
              lineHeight: 1.6,
              color: 'var(--text-muted)',
              textAlign: 'center',
              fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
            }}
          >
            {t.legal}{' '}
            <Link
              href={`/${lang}/legal/cgu`}
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
            >
              {t.legalCgu}
            </Link>{' '}
            {t.legalAnd}{' '}
            <Link
              href={`/${lang}/legal/privacy`}
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
            >
              {t.legalPrivacy}
            </Link>
            .
          </p>

          <div style={{ marginTop: 28, textAlign: 'center' }}>
            <Link
              href={`/${lang}`}
              className="sumear-login-back"
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                textDecoration: 'none',
                fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
              }}
            >
              {t.back}
            </Link>
          </div>
        </div>
      </section>

      {/* Mobile: single column, left panel hidden */}
      <style>{`
        .sumear-login-back:hover { color: var(--accent); }
        .sumear-login-google:hover:not(:disabled) { background: var(--bg-secondary) !important; }
        @media (max-width: 768px) {
          .sumear-login-grid { grid-template-columns: 1fr !important; }
          .sumear-login-brand { display: none !important; }
        }
      `}</style>
    </div>
  )
}
