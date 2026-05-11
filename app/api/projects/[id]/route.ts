import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_BUDGET = 1_000_000_000

/**
 * PATCH /api/projects/[id]
 * Body: { user_budget?: number | null }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    let body: { user_budget?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
    }

    let userBudget: number | null = null
    if ('user_budget' in body) {
      const v = body.user_budget
      if (v === null || v === '') {
        userBudget = null
      } else if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_BUDGET) {
        userBudget = v
      } else if (typeof v === 'string') {
        const n = parseFloat(v.replace(',', '.').trim())
        if (Number.isFinite(n) && n >= 0 && n <= MAX_BUDGET) userBudget = n
        else {
          return NextResponse.json({ error: 'Invalid user_budget', code: 'INVALID_BUDGET' }, { status: 400 })
        }
      } else {
        return NextResponse.json({ error: 'Invalid user_budget', code: 'INVALID_BUDGET' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'user_budget required', code: 'MISSING_FIELD' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('projects')
      .update({ user_budget: userBudget, updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .eq('user_id', user.id)
      .select('id, user_budget')
      .maybeSingle()

    if (error || !updated) {
      return NextResponse.json({ error: 'Project not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({ user_budget: updated.user_budget })
  } catch (err) {
    console.error('PATCH /api/projects/[id]:', err)
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
