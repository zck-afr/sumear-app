/**
 * In-memory sliding window rate limiter.
 *
 * On serverless (Vercel), each instance lives ~5-15 min — provides partial
 * protection within that window. Combined with quotas, this is sufficient
 * for MVP. Upgrade to Upstash Redis for cross-instance enforcement later.
 */

const windows = new Map<string, number[]>()

const CLEANUP_INTERVAL_MS = 60_000
const MAX_WINDOW_MS = 120_000

let cleanupTimer: ReturnType<typeof setInterval> | null = null

function ensureCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, timestamps] of windows) {
      const valid = timestamps.filter(t => now - t < MAX_WINDOW_MS)
      if (valid.length === 0) windows.delete(key)
      else windows.set(key, valid)
    }
  }, CLEANUP_INTERVAL_MS)
  if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref()
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

/**
 * Check and consume one request against the rate limit.
 *
 * @param key    Unique key (e.g. `chat:${userId}` or `auth:${ip}`)
 * @param max    Max requests allowed in the window
 * @param windowMs  Window duration in ms (default 60 000 = 1 minute)
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number = 60_000
): RateLimitResult {
  ensureCleanup()

  const now = Date.now()
  const timestamps = (windows.get(key) || []).filter(t => now - t < windowMs)

  if (timestamps.length >= max) {
    const oldest = timestamps[0]
    const retryAfterMs = windowMs - (now - oldest)
    windows.set(key, timestamps)
    return { allowed: false, remaining: 0, retryAfterMs }
  }

  timestamps.push(now)
  windows.set(key, timestamps)
  return { allowed: true, remaining: max - timestamps.length, retryAfterMs: 0 }
}

/** 429 JSON body matching the project's error convention. */
export function rateLimitResponse(retryAfterMs: number) {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000)
  return {
    body: {
      error: `Trop de requêtes. Réessayez dans ${retryAfterSec}s.`,
      code: 'RATE_LIMITED' as const,
    },
    status: 429 as const,
    headers: { 'Retry-After': String(retryAfterSec) },
  }
}
