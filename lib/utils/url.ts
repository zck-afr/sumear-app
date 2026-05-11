// lib/utils/url.ts
// ─────────────────────────────────────────────
// URL normalization helpers — used to deduplicate product clips when the same
// product is clipped multiple times with varying tracking parameters.
//
// Normalization rules (applied by `normalizeProductUrl`):
//   1. Lowercase the hostname (URL constructor does this automatically, but we
//      keep an explicit pass for clarity).
//   2. Drop the URL fragment (#...).
//   3. Strip common tracking query parameters (utm_*, ref, tag, fbclid, gclid…).
//   4. Drop the trailing slash from the pathname (except for root "/").
//   5. Strip default ports (80 for http, 443 for https).
//
// IMPORTANT:
// - We do NOT strip "www." — `m.amazon.com` and `amazon.com` can serve
//   different content; same applies to `www.` in some edge cases. We err on
//   the safe side and treat them as distinct URLs.
// - The normalized URL is computed on the fly and NEVER persisted; the schema
//   continues to store the raw `source_url`.
// ─────────────────────────────────────────────

/**
 * Tracking query parameters dropped during normalization.
 * Anything starting with "utm_" is also stripped (handled by the prefix check).
 */
const TRACKING_PARAMS: ReadonlySet<string> = new Set([
  // Generic
  'ref', 'ref_', 'referer', 'referrer',
  // Amazon
  'tag', 'th', 'psc', 'linkCode', 'linkId', 'creative', 'creativeASIN',
  'pd_rd_w', 'pd_rd_r', 'pd_rd_wg', 'pd_rd_i',
  'pf_rd_p', 'pf_rd_r', 'pf_rd_s', 'pf_rd_t', 'pf_rd_i', 'pf_rd_m',
  'qid', 'sr', 'sprefix', 'crid', 'keywords',
  // Ads / analytics click IDs
  'fbclid', 'gclid', 'gclsrc', 'msclkid', 'dclid', 'yclid', 'twclid',
  'igshid', 'mc_cid', 'mc_eid', '_ga', '_gl', 'wickedid',
  // AliExpress / Asian marketplaces
  'spm', 'scm', 'aff_short_key', 'aff_platform', 'aff_trace_key',
  'algo_pvid', 'algo_expid',
  // Misc affiliate / sharing
  'cmpid', 'cmp', 'campaign', 'source', 'srsltid',
])

/**
 * Extracts the bare domain from a URL (lowercased, www. stripped).
 * Used for indexed lookup of duplicate candidates.
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * Returns a stable, comparable form of a product URL.
 * Falls back to the trimmed input if the URL cannot be parsed.
 */
export function normalizeProductUrl(url: string): string {
  if (typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (!trimmed) return ''

  let u: URL
  try {
    u = new URL(trimmed)
  } catch {
    return trimmed
  }

  // Hostname (URL already lowercases, but be explicit).
  u.hostname = u.hostname.toLowerCase()

  // Drop fragment.
  u.hash = ''

  // Strip default ports.
  if (
    (u.protocol === 'http:' && u.port === '80') ||
    (u.protocol === 'https:' && u.port === '443')
  ) {
    u.port = ''
  }

  // Strip tracking params (case-insensitive on the key).
  const cleaned = new URLSearchParams()
  for (const [k, v] of u.searchParams) {
    const lk = k.toLowerCase()
    if (lk.startsWith('utm_')) continue
    if (TRACKING_PARAMS.has(lk)) continue
    cleaned.append(k, v)
  }
  // Sort keys for stable comparison (?b=2&a=1 → ?a=1&b=2).
  const sortedEntries = [...cleaned.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  )
  const sorted = new URLSearchParams(sortedEntries)
  u.search = sorted.toString() ? `?${sorted.toString()}` : ''

  // Drop trailing slash (but keep root '/').
  if (u.pathname.length > 1) {
    u.pathname = u.pathname.replace(/\/+$/, '') || '/'
  }

  return u.toString()
}
