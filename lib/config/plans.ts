/**
 * Limites par plan — source de vérité pour les quotas (voir PRELAUNCH.md).
 * profiles.plan en BDD : free | pro | complete — en app, `pro` est traité comme paid (même limites que complete).
 */

export type BillingPlan = 'free' | 'complete'

export const PLAN_LIMITS = {
  free: {
    ai_messages_per_month: 25,
    clips_total: 8,
    projects_total: 2,
  },
  complete: {
    ai_messages_per_month: 1000,
    clips_total: Number.POSITIVE_INFINITY,
    projects_total: Number.POSITIVE_INFINITY,
  },
} as const

/** Normalise le plan stocké en profil (pro → complete pour les limites). */
export function normalizeBillingPlan(raw: string | null | undefined): BillingPlan {
  if (raw === 'free') return 'free'
  return 'complete'
}
