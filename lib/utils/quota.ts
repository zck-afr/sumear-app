import { SupabaseClient } from '@supabase/supabase-js'
import { normalizeBillingPlan, PLAN_LIMITS, type BillingPlan } from '@/lib/config/plans'

export type QuotaCheckType = 'ai_messages' | 'clips' | 'projects'

export interface QuotaResult {
  is_allowed: boolean
  /** Plan normalisé pour l'affichage / logique métier */
  plan: BillingPlan
  clips_count: number
  clips_limit: number
  ai_messages_count: number
  ai_messages_limit: number
  projects_count: number
  projects_limit: number
}

/**
 * Vérifie un quota précis. Les champs non concernés par `type` sont remplis à 0 / Infinity selon le cas.
 */
export async function checkQuota(
  supabase: SupabaseClient,
  userId: string,
  type: QuotaCheckType
): Promise<QuotaResult> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .maybeSingle()

  // Fail-closed : pas de ligne profil, erreur réseau/RLS, ou plan NULL → quotas « free »
  const rawPlan = profile?.plan
  const plan: BillingPlan =
    profileError || !profile || rawPlan == null || String(rawPlan).trim() === ''
      ? 'free'
      : normalizeBillingPlan(rawPlan)
  const limits = PLAN_LIMITS[plan]

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  let clipsCount = 0
  let projectsCount = 0
  let aiMessagesCount = 0

  const { count: clipTotal } = await supabase
    .from('clips')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  clipsCount = clipTotal ?? 0

  const { count: projectTotal } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  projectsCount = projectTotal ?? 0

  const { data: usageRow } = await supabase
    .from('usage')
    .select('*')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  const rawRow = usageRow as Record<string, unknown> | null
  aiMessagesCount = typeof rawRow?.ai_messages_count === 'number' ? rawRow.ai_messages_count : 0

  const clipsLimit = limits.clips_total
  const projectsLimit = limits.projects_total
  const aiLimit = limits.ai_messages_per_month

  let isAllowed = true
  if (type === 'clips') isAllowed = clipsCount < clipsLimit
  else if (type === 'projects') isAllowed = projectsCount < projectsLimit
  else if (type === 'ai_messages') isAllowed = aiMessagesCount < aiLimit

  const asLimit = (n: number) => (Number.isFinite(n) ? n : -1)

  return {
    is_allowed: isAllowed,
    plan,
    clips_count: clipsCount,
    clips_limit: asLimit(clipsLimit),
    ai_messages_count: aiMessagesCount,
    ai_messages_limit: asLimit(aiLimit),
    projects_count: projectsCount,
    projects_limit: asLimit(projectsLimit),
  }
}

export type IncrementUsageType = 'clips' | 'ai_messages'

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

/**
 * Incrémente les compteurs mensuels dans `usage` via la fonction SECURITY DEFINER `increment_usage`.
 * Les quotas clips/projets se basent sur le nombre de lignes — ne pas appeler pour `clips` après un insert.
 * Pass `tokens` to also aggregate token/cost data in the monthly usage row.
 */
export async function incrementUsage(
  supabase: SupabaseClient,
  userId: string,
  kind: IncrementUsageType,
  amount: number = 1,
  tokens?: TokenUsage
): Promise<boolean> {
  const p_clips = kind === 'clips' ? amount : 0
  const p_ai_messages = kind === 'ai_messages' ? amount : 0

  const { error } = await supabase.rpc('increment_usage', {
    p_user_id: userId,
    p_clips: p_clips,
    p_comparisons: 0,
    p_input_tokens: tokens?.input_tokens ?? 0,
    p_output_tokens: tokens?.output_tokens ?? 0,
    p_api_cost: tokens?.cost_usd ?? 0,
    p_ai_messages: p_ai_messages,
  })

  if (error) {
    console.error('[quota] increment_usage RPC failed:', error.message, error)
    return false
  }
  return true
}
