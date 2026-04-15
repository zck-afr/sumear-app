import { NextResponse } from 'next/server'
import { createClient, createClientWithJWT } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_USER_ID = process.env.ADMIN_USER_ID

/**
 * GET /api/admin/suspicious
 * Returns the 50 most recent security logs (prompt injection attempts).
 * Protected: only ADMIN_USER_ID can access.
 */
export async function GET(request: Request) {
  if (!ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Admin not configured' }, { status: 503 })
  }

  let userId: string | null = null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    userId = user.id
  } else {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
    if (token) {
      const jwtClient = createClientWithJWT(token)
      const { data: { user: jwtUser } } = await jwtClient.auth.getUser(token)
      if (jwtUser) userId = jwtUser.id
    }
  }

  if (userId !== ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('security_logs')
    .select('id, user_id, message, triggers, ip, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[admin/suspicious] query failed:', error.message)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  return NextResponse.json({ logs: data, count: data.length })
}
