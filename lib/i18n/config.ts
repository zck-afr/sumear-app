// lib/i18n/config.ts
// ─────────────────────────────────────────────
// i18n configuration for Sumear marketing pages
// Strategy: /fr/... and /en/... sub-routes (SEO-friendly)
// ─────────────────────────────────────────────

export const defaultLocale = 'en' as const;
export const locales = ['fr', 'en'] as const;
export type Locale = (typeof locales)[number];

export function isValidLocale(lang: string): lang is Locale {
  return locales.includes(lang as Locale);
}
