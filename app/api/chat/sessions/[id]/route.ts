import { NextResponse } from 'next/server'
import { createClient, createClientWithJWT } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * GET /api/chat/sessions/[id]
 * Détail d'une session : messages + infos des clips pour reprendre la conversation.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params
    let supabase = await createClient()
    let user: User | null = (await supabase.auth.getUser()).data.user

    if (!user) {
      const authHeader = request.headers.get('Authorization')
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
      if (token) {
        const jwtClient = createClientWithJWT(token)
        const { data: { user: u } } = await jwtClient.auth.getUser(token)
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

    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id, title, session_type, web_search_enabled, created_at, updated_at')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    const { data: messages } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    const { data: clipRows } = await supabase
      .from('chat_session_clips')
      .select('clip_id')
      .eq('session_id', sessionId)

    const clipIds = (clipRows ?? []).map((r) => r.clip_id)
    let clips: Array<{
      id: string
      product_name: string
      brand: string | null
      price: number | null
      currency: string
      image_url: string | null
      source_domain: string
      rating?: number | null
      review_count?: number | null
    }> = []
    if (clipIds.length > 0) {
      const { data } = await supabase
        .from('clips')
        .select('id, product_name, brand, price, currency, image_url, source_domain, rating, review_count')
        .in('id', clipIds)
        .eq('user_id', user.id)
      if (data) clips = data
    }

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        session_type: (session as { session_type?: string | null }).session_type ?? 'clip_based',
        web_search_enabled:
          (session as { web_search_enabled?: boolean | null }).web_search_enabled ?? false,
        created_at: session.created_at,
        updated_at: session.updated_at,
      },
      messages: (messages ?? []).map((m) => ({ role: m.role, content: m.content })),
      clip_ids: clipIds,
      clips,
    })
  } catch (err) {
    console.error('Unexpected error in GET /api/chat/sessions/[id]:', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/chat/sessions/[id]
 *
 * Removes a chat session. RLS already restricts deletion to the owner;
 * we add `.eq('user_id', user.id)` belt-and-suspenders.
 *
 * `chat_messages` and `chat_session_clips` are removed automatically by
 * the FK ON DELETE CASCADE declared in `database/chat_history.sql`.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const { error, count } = await supabase
      .from('chat_sessions')
      .delete({ count: 'exact' })
      .eq('id', sessionId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Chat session delete error:', error)
      return NextResponse.json(
        { error: 'Failed to delete session', code: 'DB_ERROR' },
        { status: 500 }
      )
    }
    if (count === 0) {
      // Either the session doesn't exist or doesn't belong to the user.
      // Return 404 in both cases (don't leak existence).
      return NextResponse.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Unexpected error in DELETE /api/chat/sessions/[id]:', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
