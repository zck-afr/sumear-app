import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/auth/token
 * Returns the current user's access token.
 * Called by the Chrome extension to authenticate API requests.
 * 
 * This endpoint uses cookie auth (the user must be logged in on the dashboard).
 * The extension fetches this from the app domain where cookies are available.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      return NextResponse.json(
        { error: 'Not authenticated', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      access_token: session.access_token,
      expires_at: session.expires_at,
      user: {
        id: session.user.id,
        email: session.user.email,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
