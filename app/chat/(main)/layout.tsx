// ============================================================================
// /chat layout — standalone, outside the (dashboard) group.
// Scoped to app/chat/(main)/ so it does NOT apply to app/chat/embed/
// (which has its own postMessage auth and cannot use server-side cookies).
// Auth guard lives here; plan check is in page.tsx.
// ============================================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChatLayoutShell } from '@/components/chat/chat-layout-shell'

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Read display info from auth metadata (same source as DashboardShell).
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const name =
    typeof meta.full_name === 'string' ? meta.full_name :
    typeof meta.name === 'string' ? meta.name :
    typeof user.email === 'string' ? user.email.split('@')[0] :
    'User'
  const avatarUrl = typeof meta.avatar_url === 'string' ? meta.avatar_url : null

  return (
    <ChatLayoutShell name={name} avatarUrl={avatarUrl}>
      {children}
    </ChatLayoutShell>
  )
}
