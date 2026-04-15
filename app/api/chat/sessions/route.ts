import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/chat/sessions
 * Liste des sessions de chat de l'utilisateur (historique) — données enrichies.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const { data: rawSessions, error } = await supabase
      .from('chat_sessions')
      .select(`
        id,
        title,
        created_at,
        updated_at,
        chat_messages(content, role, created_at),
        chat_session_clips(
          clips(product_name, price, image_url)
        )
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Chat sessions list error:', error)
      return NextResponse.json(
        { error: 'Failed to load sessions', code: 'DB_ERROR' },
        { status: 500 }
      )
    }

    type RawMessage = { content: string; role: string; created_at: string }
    type RawClip    = { product_name: string; price: number | null; image_url: string | null }

    const sessions = (rawSessions ?? []).map(s => {
      const messages: RawMessage[] = Array.isArray(s.chat_messages) ? s.chat_messages : []

      const firstUserMsg = messages
        .filter(m => m.role === 'user')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0] ?? null

      const products: RawClip[] = (Array.isArray(s.chat_session_clips) ? s.chat_session_clips : [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((row: any) => row.clips)
        .filter(Boolean)

      const isComparison = products.length > 1
      const first = products[0] ?? null

      return {
        id:            s.id,
        title:         s.title,
        created_at:    s.created_at,
        updated_at:    s.updated_at,
        first_message: firstUserMsg?.content ?? null,
        message_count: messages.length,
        product_name:  first?.product_name ?? null,
        product_price: isComparison ? null : (first?.price ?? null),
        product_image: first?.image_url ?? null,
        is_comparison: isComparison,
      }
    })

    return NextResponse.json({ sessions })
  } catch (err) {
    console.error('Unexpected error in GET /api/chat/sessions:', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
