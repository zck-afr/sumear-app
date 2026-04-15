import { NextResponse } from 'next/server'
import { createClient, createClientWithJWT } from '@/lib/supabase/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

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

/** GET /api/projects/[id]/clips — return clip IDs belonging to this project */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase } = await resolveAuth(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: clips, error } = await supabase
    .from('clips')
    .select('id')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: 'Failed to fetch clips' }, { status: 500 })
  return NextResponse.json({ clip_ids: clips?.map(c => c.id) ?? [] })
}
