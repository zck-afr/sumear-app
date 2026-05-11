'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export function DashboardHeader({ user }: { user: User }) {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const avatarUrl = user.user_metadata?.avatar_url
  const fullName = user.user_metadata?.full_name || user.email

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-6">
      {/* Mobile menu button placeholder */}
      <div className="lg:hidden">
        <span className="text-lg font-bold text-gray-900">Sumear</span>
      </div>

      <div className="flex flex-1 justify-end gap-x-4">
        {/* User menu */}
        <div className="flex items-center gap-x-3">
          <span className="text-sm text-gray-600 hidden sm:block">
            {fullName}
          </span>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-8 w-8 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-xs font-medium text-gray-600">
                {(user.email || '?')[0].toUpperCase()}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  )
}
