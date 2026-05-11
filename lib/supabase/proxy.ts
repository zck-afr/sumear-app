import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { locales } from '@/lib/i18n/config'

// Login lives at /${lang}/login (canonical) but the bare /login is also
// accepted (proxy.ts redirects it to /${locale}/login). Treat all of these
// as "the login page" to avoid the unauthenticated-redirect-loop.
function isLoginPath(path: string): boolean {
  if (path === '/login' || path.startsWith('/login/')) return true
  return locales.some(
    (l) => path === `/${l}/login` || path.startsWith(`/${l}/login/`)
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Don't redirect on API routes, callback, or embeds (iframe auth via postMessage)
  if (
    path.startsWith('/api') ||
    path.startsWith('/callback') ||
    path.startsWith('/chat/embed')
  ) {
    return supabaseResponse
  }

  // Authenticated user on a login page → bounce to dashboard
  if (user && isLoginPath(path)) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Unauthenticated user on protected route → bounce to login
  if (!user && !isLoginPath(path)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse

}
