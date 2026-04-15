// components/marketing/legal-content.tsx
// ─────────────────────────────────────────────
// Renders legal page content (markdown parsed to HTML).
// Replaces the placeholder component.
// ─────────────────────────────────────────────

import type { Locale } from '@/lib/i18n/config';

interface LegalContentProps {
  html: string;
  lang: Locale;
  backHome: string;
}

export function LegalContent({ html, lang, backHome }: LegalContentProps) {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '64px 24px 80px',
      }}
    >
      <div
        className="legal-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--bg-sidebar)' }}>
        <a
          href={`/${lang}`}
          style={{
            color: 'var(--accent)',
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          ← {backHome}
        </a>
      </div>
    </div>
  );
}
