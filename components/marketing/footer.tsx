// components/marketing/footer.tsx
// ─────────────────────────────────────────────
// Marketing footer: legal links + copyright
// ─────────────────────────────────────────────

import type { Locale } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/dictionaries/fr';

interface MarketingFooterProps {
  lang: Locale;
  dict: Dictionary;
}

export function MarketingFooter({ lang, dict }: MarketingFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        borderTop: '1px solid var(--bg-sidebar)',
        padding: '32px 24px',
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}
      >
        <span>{dict.footer.rights.replace('{year}', String(year))}</span>
        <nav style={{ display: 'flex', gap: 24 }}>
          <a
            href={`/${lang}/legal/cgu`}
            style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
          >
            {dict.footer.legal}
          </a>
          <a
            href={`/${lang}/legal/privacy`}
            style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
          >
            {dict.footer.privacy}
          </a>
          <a
            href={`/${lang}/legal/mentions`}
            style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
          >
            {dict.footer.mentions}
          </a>
        </nav>
      </div>
    </footer>
  );
}
