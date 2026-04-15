// lib/i18n/get-dictionary.ts
// ─────────────────────────────────────────────

import { notFound } from 'next/navigation';
import { isValidLocale, type Locale } from './config';
import type { Dictionary } from './dictionaries/fr';

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  fr: () => import('./dictionaries/fr').then((m) => m.default),
  en: () => import('./dictionaries/en').then((m) => m.default),
};

export async function getDictionary(locale: string): Promise<Dictionary> {
  if (!isValidLocale(locale)) {
    notFound();
  }
  return dictionaries[locale]();
}
