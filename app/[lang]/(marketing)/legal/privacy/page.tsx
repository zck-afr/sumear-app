// app/[lang]/(marketing)/legal/privacy/page.tsx
// ─────────────────────────────────────────────

import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getLegalContent } from '@/lib/legal/get-legal-content';
import type { Locale } from '@/lib/i18n/config';
import { LegalContent } from '@/components/marketing/legal-content';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);
  return {
    title: `${dict.legal.privacy.title} — Sumear`,
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: langStr } = await params;
  const lang = langStr as Locale;
  const dict = await getDictionary(lang);
  const html = await getLegalContent(lang, 'privacy');

  return (
    <LegalContent
      html={html}
      lang={lang}
      backHome={dict.legal.backHome}
    />
  );
}
