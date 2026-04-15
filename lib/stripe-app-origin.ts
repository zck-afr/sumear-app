/**
 * Base URL pour success/cancel Stripe — ne jamais faire confiance à `Origin` seul
 * (open redirect : un site tiers pourrait recevoir l’utilisateur après checkout).
 */
export function trustedAppOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  if (configured) {
    return configured
  }

  const origin = request.headers.get('origin')?.trim().replace(/\/$/, '') || ''
  if (origin) {
    try {
      const { protocol, hostname } = new URL(origin)
      if (protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1')) {
        return origin
      }
    } catch {
      /* ignore */
    }
  }

  return 'http://localhost:3000'
}
