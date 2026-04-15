// components/marketing/header.tsx
'use client';

// ─────────────────────────────────────────────
// Marketing header: logo + nav (Features, Pricing) + lang toggle + login CTA
// OAuth Google login is triggered directly from the landing page.
// ─────────────────────────────────────────────

import { useRouter, usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import type { Locale } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/dictionaries/fr';

// Singleton — avoid re-creating on every render/click
// If you already have lib/supabase/client.ts exporting a browser client,
// replace this with: import { supabase } from '@/lib/supabase/client';
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface MarketingHeaderProps {
  lang: Locale;
  dict: Dictionary;
}

export function MarketingHeader({ lang, dict }: MarketingHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const otherLang = lang === 'fr' ? 'en' : 'fr';
  const otherLangLabel = lang === 'fr' ? 'EN' : 'FR';

  function handleLanguageSwitch() {
    // Safely replace only the leading locale segment
    const newPath = pathname.replace(new RegExp(`^/${lang}(?=/|$)`), `/${otherLang}`);
    // Set cookie so middleware remembers the choice
    document.cookie = `sumear-locale=${otherLang};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
    router.push(newPath);
  }

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) {
      console.error('OAuth error:', error.message);
    }
  }

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        borderBottom: '1px solid var(--bg-sidebar)',
        backdropFilter: 'blur(12px)',
        backgroundColor: 'color-mix(in srgb, var(--bg-page) 85%, transparent)',
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '0 24px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <a
          href={`/${lang}`}
          style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* 
            TODO: Replace with <SumearLogoBadge /> + <SumearWordmark /> 
            from your existing components 
          */}
          <span
            style={{
              fontFamily: 'var(--font-playfair-display), Playfair Display, serif',
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            <span style={{ color: 'var(--accent)' }}>su·</span>mear
          </span>
        </a>

        {/* Nav */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 32,
          }}
        >
          <a
            href={`/${lang}#features`}
            style={{
              textDecoration: 'none',
              color: 'var(--text-secondary)',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
            }}
          >
            {dict.nav.features}
          </a>
          <a
            href={`/${lang}#pricing`}
            style={{
              textDecoration: 'none',
              color: 'var(--text-secondary)',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
            }}
          >
            {dict.nav.pricing}
          </a>

          {/* Language toggle */}
          <button
            onClick={handleLanguageSwitch}
            style={{
              background: 'none',
              border: '1px solid var(--text-secondary)',
              borderRadius: 6,
              padding: '4px 10px',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
            }}
          >
            {otherLangLabel}
          </button>

          {/* Login CTA */}
          <button
            onClick={handleLogin}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
            }}
          >
            {dict.nav.login}
          </button>
        </nav>
      </div>
    </header>
  );
}
