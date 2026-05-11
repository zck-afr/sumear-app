import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { DashboardShell } from '@/components/dashboard/sidebar'
import { defaultLocale, isValidLocale } from '@/lib/i18n/config'

async function resolveLocale(): Promise<string> {
  // 1. Cookie (user's explicit choice)
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('sumear-locale')?.value
  if (cookieLocale && isValidLocale(cookieLocale)) return cookieLocale

  // 2. Accept-Language header
  const headerStore = await headers()
  const accept = headerStore.get('accept-language')
  if (accept) {
    const preferred = accept
      .split(',')
      .map((lang) => lang.split(';')[0].trim().substring(0, 2).toLowerCase())
      .find((lang) => isValidLocale(lang))
    if (preferred) return preferred
  }

  return defaultLocale
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const locale = await resolveLocale()
    redirect(`/${locale}/login`)
  }

  return <DashboardShell user={user}>{children}</DashboardShell>
}
