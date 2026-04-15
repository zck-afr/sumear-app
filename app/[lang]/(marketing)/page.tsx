// app/[lang]/(marketing)/page.tsx
// Landing: Hero → Features → Pricing (dark strip) → FAQ.
// Header and footer live in (marketing)/layout.tsx.

import { getDictionary } from '@/lib/i18n/get-dictionary';
import type { Locale } from '@/lib/i18n/config';
import { HeroSection } from '@/components/marketing/hero-section';
import { FeaturesSection } from '@/components/marketing/features-section';
import { PricingSection } from '@/components/marketing/pricing-section';
import { FaqSection } from '@/components/marketing/faq-section';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: {
      canonical: `https://sumear.app/${lang}`,
      languages: {
        fr: 'https://sumear.app/fr',
        en: 'https://sumear.app/en',
      },
    },
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: langStr } = await params;
  const lang = langStr as Locale;
  const dict = await getDictionary(lang);

  return (
    <div style={{ background: 'var(--bg-page)' }}>
      <HeroSection lang={lang} dict={dict} />
      <FeaturesSection dict={dict} />
      <div style={{ background: '#2A1E18', padding: 0 }}>
        <PricingSection lang={lang} dict={dict} onDarkBackground />
      </div>
      <FaqSection dict={dict} />
    </div>
  );
}
