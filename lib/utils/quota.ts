import { SupabaseClient } from '@supabase/supabase-js'

interface QuotaResult {
  is_allowed: boolean
  clips_count: number
  clips_limit: number
  comparisons_count: number
  comparisons_limit: number
  plan: string
}

const PLAN_LIMITS = {
  free: { clips: 20, comparisons: 5, projects: 3 },
  pro: { clips: Infinity, comparisons: Infinity, projects: Infinity },
  complete: { clips: Infinity, comparisons: 40, projects: Infinity },
} as const

/**
 * Check if user has remaining quota for clips or comparisons.
 */
export async function checkQuota(
  supabase: SupabaseClient,
  userId: string,
  type: 'clips' | 'comparisons'
): Promise<QuotaResult> {
  // Get user plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()

  const plan = (profile?.plan || 'free') as keyof typeof PLAN_LIMITS
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free

  // Get current month usage
  const now = new Date()
  const { data: usage } = await supabase
    .from('usage')
    .select('clips_count, comparisons_count')
    .eq('user_id', userId)
    .eq('year', now.getFullYear())
    .eq('month', now.getMonth() + 1)
    .single()

  const clipsCount = usage?.clips_count || 0
  const comparisonsCount = usage?.comparisons_count || 0

  const isAllowed = type === 'clips'
    ? clipsCount < limits.clips
    : comparisonsCount < limits.comparisons

  return {
    is_allowed: isAllowed,
    clips_count: clipsCount,
    clips_limit: limits.clips,
    comparisons_count: comparisonsCount,
    comparisons_limit: limits.comparisons,
    plan,
  }
}

/**
 * Increment usage counter after a successful action.
 */
export async function incrementUsage(
  supabase: SupabaseClient,
  userId: string,
  type: 'clips' | 'comparisons',
  amount: number = 1
): Promise<void> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // Upsert: create if not exists, increment if exists
  const { data: existing } = await supabase
    .from('usage')
    .select('id, clips_count, comparisons_count')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month)
    .single()

  if (existing) {
    const update = type === 'clips'
      ? { clips_count: existing.clips_count + amount }
      : { comparisons_count: existing.comparisons_count + amount }

    await supabase
      .from('usage')
      .update(update)
      .eq('id', existing.id)
  } else {
    await supabase
      .from('usage')
      .insert({
        user_id: userId,
        year,
        month,
        clips_count: type === 'clips' ? amount : 0,
        comparisons_count: type === 'comparisons' ? amount : 0,
      })
  }
}
