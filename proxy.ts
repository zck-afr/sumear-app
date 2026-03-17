import { type NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  // Never run auth redirect for embed iframes (auth is via postMessage; avoid loading Google OAuth in iframe → 403)
  if (path.startsWith('/chat/embed') || path.startsWith('/compare/embed')) {
    const res = NextResponse.next({ request })
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    return res
  }
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Exclude static assets, api, and embed routes (iframe auth via postMessage; no redirect)
    '/((?!_next/static|_next/image|favicon.ico|api|chat/embed|compare/embed|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
