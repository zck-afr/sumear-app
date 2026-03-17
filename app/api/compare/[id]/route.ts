import { NextResponse } from 'next/server'
import { createClient, createClientWithJWT } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * GET /api/compare/[id]
 * Returns comparison + clips for the authenticated user.
 * Auth: cookies or Authorization: Bearer <token> (for embed iframe).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    let supabase = await createClient()
    let user: User | null = (await supabase.auth.getUser()).data.user

    if (!user) {
      const authHeader = request.headers.get('Authorization')
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
      if (token) {
        const jwtClient = createClientWithJWT(token)
        const { data: { user: u }, error: userError } = await jwtClient.auth.getUser(token)
        if (userError) {
          console.warn('GET /api/compare/[id] JWT getUser failed:', userError.message)
        }
        if (u) {
          user = u
          supabase = jwtClient
        }
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const { data: comparison, error: compError } = await supabase
      .from('comparisons')
      .select('id, status, model_used, result_analysis, created_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (compError || !comparison) {
      return NextResponse.json(
        { error: 'Comparison not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    const { data: clipLinks } = await supabase
      .from('comparison_clips')
      .select('clip_id')
      .eq('comparison_id', id)
    const clipIds = clipLinks?.map(l => l.clip_id) || []
    const { data: rawClips } = await supabase
      .from('clips')
      .select('id, product_name, brand, price, currency, rating, review_count, image_url, source_domain')
      .in('id', clipIds)
    const clips = clipIds.map(cid => rawClips?.find(c => c.id === cid)).filter(Boolean)

    return NextResponse.json({
      comparison: {
        id: comparison.id,
        status: comparison.status,
        model_used: comparison.model_used,
        result_analysis: comparison.result_analysis,
        created_at: comparison.created_at,
      },
      clips,
    })
  } catch (err) {
    console.error('GET /api/compare/[id]:', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
