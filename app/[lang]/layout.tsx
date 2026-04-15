// app/[lang]/layout.tsx
// ─────────────────────────────────────────────
// Root layout for locale-prefixed routes.
// This wraps ONLY marketing pages (landing, pricing, legal).
// Dashboard routes remain at /(dashboard)/ without locale prefix.
// ─────────────────────────────────────────────

import { locales, isValidLocale } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  if (!isValidLocale(lang)) {
    notFound();
  }

  // This layout just passes through — the actual <html> and <body>
  // are in the root app/layout.tsx which already exists in your repo.
  // If you need this to be the root, move fonts/theme logic here.
  return <>{children}</>;
}
