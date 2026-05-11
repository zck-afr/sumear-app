import { NextResponse } from 'next/server'
import { createClient, createClientWithJWT } from '@/lib/supabase/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { checkQuota } from '@/lib/utils/quota'
import { checkRateLimit, rateLimitResponse } from '@/lib/utils/rate-limit'

async function resolveAuth(request: Request): Promise<{ user: User | null; supabase: SupabaseClient }> {
  let supabase = await createClient()
  let user: User | null = (await supabase.auth.getUser()).data.user
  if (!user) {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim()
    if (token) {
      const jwtClient = createClientWithJWT(token)
      const { data: { user: u } } = await jwtClient.auth.getUser(token)
      if (u) { user = u; supabase = jwtClient as unknown as SupabaseClient }
    }
  }
  return { user, supabase }
}

/** GET /api/projects — list the authenticated user's projects */
export async function GET(request: Request) {
  const { user, supabase } = await resolveAuth(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, emoji')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  return NextResponse.json({ projects: projects ?? [] })
}

/** POST /api/projects — create a new project */
export async function POST(request: Request) {
  const { user, supabase } = await resolveAuth(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const rl = checkRateLimit(`projects:${user.id}`, 5)
  if (!rl.allowed) {
    const r = rateLimitResponse(rl.retryAfterMs)
    return NextResponse.json(r.body, { status: r.status, headers: r.headers })
  }

  let body: { name?: string; emoji?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.name?.trim()) return NextResponse.json({ error: 'name is required', code: 'MISSING_FIELDS' }, { status: 400 })
  if (body.name.length > 100) return NextResponse.json({ error: 'name too long (100 max)', code: 'INVALID_INPUT' }, { status: 400 })
  if (body.emoji && (typeof body.emoji !== 'string' || body.emoji.length > 10)) {
    return NextResponse.json({ error: 'invalid emoji', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const quota = await checkQuota(supabase, user.id, 'projects')
  if (!quota.is_allowed) {
    return NextResponse.json(
      {
        error: 'Project quota reached (Free plan: 2 projects max). Upgrade to Complete for unlimited projects.',
        code: 'QUOTA_EXCEEDED',
        projects_count: quota.projects_count,
        projects_limit: quota.projects_limit,
        plan: quota.plan,
      },
      { status: 429 }
    )
  }

  const { data: project, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name: body.name.trim(), emoji: body.emoji ?? '📁' })
    .select('id, name, emoji')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  return NextResponse.json({ project }, { status: 201 })
}
