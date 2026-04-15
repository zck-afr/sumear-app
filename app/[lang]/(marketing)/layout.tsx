// app/[lang]/(marketing)/layout.tsx
// ─────────────────────────────────────────────
// Marketing layout: header + footer, no dashboard sidebar.
// Design tokens use Sumear CSS variables from globals.css.
// ─────────────────────────────────────────────

import { getDictionary } from '@/lib/i18n/get-dictionary';
import type { Locale } from '@/lib/i18n/config';
import { MarketingHeader } from '@/components/marketing/header';
import { MarketingFooter } from '@/components/marketing/footer';

export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang: langStr } = await params;
  const lang = langStr as Locale;
  const dict = await getDictionary(lang);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-page)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
      }}
    >
      <MarketingHeader lang={lang} dict={dict} />
      <main style={{ flex: 1 }}>{children}</main>
      <MarketingFooter lang={lang} dict={dict} />
    </div>
  );
}
