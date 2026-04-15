import { type NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { defaultLocale, locales } from '@/lib/i18n/config'

// ── i18n helpers ──

const MARKETING_PATHS_EXACT = [
  '/',
  '/pricing',
  '/legal',
  '/privacy',
  '/mentions',
  '/cgu',
]
const MARKETING_PATHS_PREFIX = ['/legal/']

function isMarketingPath(pathname: string): boolean {
  if (MARKETING_PATHS_EXACT.includes(pathname)) return true
  return MARKETING_PATHS_PREFIX.some((prefix) => pathname.startsWith(prefix))
}

/** Paths without locale that must map under /[lang]/legal/... */
const MARKETING_PATH_SHORTCUTS: Record<string, string> = {
  '/legal': '/legal/cgu',
  '/privacy': '/legal/privacy',
  '/mentions': '/legal/mentions',
  '/cgu': '/legal/cgu',
}

function localePrefixedPath(pathname: string, locale: string): string {
  if (pathname === '/') return `/${locale}`
  const normalized = MARKETING_PATH_SHORTCUTS[pathname] ?? pathname
  return `/${locale}${normalized}`
}

function hasLocalePrefix(pathname: string): boolean {
  return locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )
}

function hasSupabaseSession(request: NextRequest): boolean {
  const cookies = request.cookies.getAll()
  return cookies.some(
    (c) => c.name.startsWith('sb-') && c.name.includes('auth-token')
  )
}

function getPreferredLocale(request: NextRequest): string {
  // 1. Cookie (user chose a language before)
  const cookieLocale = request.cookies.get('sumear-locale')?.value
  if (cookieLocale && locales.includes(cookieLocale as any)) {
    return cookieLocale
  }

  // 2. Accept-Language header
  const acceptLang = request.headers.get('Accept-Language')
  if (acceptLang) {
    const preferred = acceptLang
      .split(',')
      .map((lang) => lang.split(';')[0].trim().substring(0, 2).toLowerCase())
      .find((lang) => locales.includes(lang as any))
    if (preferred) return preferred
  }

  return defaultLocale
}

// ── Proxy ──

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Never run auth redirect for embed iframes (auth is via postMessage; avoid loading Google OAuth in iframe → 403)
  if (path.startsWith('/chat/embed')) {
    const res = NextResponse.next({ request })
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    return res
  }

  // ── i18n redirect for marketing pages ──
  // Must run BEFORE updateSession so anonymous visitors get redirected
  // to /fr or /en without hitting the auth guard.
  if (!hasLocalePrefix(path) && isMarketingPath(path)) {
    // '/' with an active session → skip to dashboard (no i18n redirect)
    if (path === '/' && hasSupabaseSession(request)) {
      return await updateSession(request)
    }

    // Anonymous visitor on a marketing path → redirect to locale-prefixed URL
    const locale = getPreferredLocale(request)
    const url = request.nextUrl.clone()
    url.pathname = localePrefixedPath(path, locale)
    return NextResponse.redirect(url, 307)
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    // Exclude static assets, api, and embed routes (iframe auth via postMessage; no redirect)
    '/((?!_next/static|_next/image|favicon.ico|api|chat/embed|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
