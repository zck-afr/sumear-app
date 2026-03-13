import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/chat/sessions
 * Liste des sessions de chat de l'utilisateur (historique).
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

    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at, updated_at')
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

    return NextResponse.json({ sessions: sessions ?? [] })
  } catch (err) {
    console.error('Unexpected error in GET /api/chat/sessions:', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
