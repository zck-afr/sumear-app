// ============================================================================
// /chat — conversational chat (Sumear AI shopping assistant).
//
// Server component: validates plan, defers to the client shell.
// Auth is already validated by the parent layout (app/chat/(main)/layout.tsx).
// Plan check is duplicated here AND in /api/chat/conversational — never
// trust the client.
// ============================================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normalizeBillingPlan } from '@/lib/config/plans'
import { ChatPageClient } from '@/components/chat/chat-page-client'

export const dynamic = 'force-dynamic'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .maybeSingle()

  const plan = normalizeBillingPlan(profile?.plan)
  const isFree = plan === 'free'

  return <ChatPageClient isFree={isFree} userId={user.id} />
}
