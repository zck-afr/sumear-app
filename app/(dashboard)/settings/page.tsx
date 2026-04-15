import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SettingsClient } from '@/components/settings/settings-client'
import { getStripe } from '@/lib/stripe'
import type Stripe from 'stripe'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>
}) {
  const sp = await searchParams
  const checkoutFlash =
    sp.checkout === 'success' ? 'success' : sp.checkout === 'cancel' ? 'cancel' : null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, stripe_customer_id, stripe_subscription_id, subscription_period_end')
    .eq('id', user.id)
    .single()

  const plan = profile?.plan ?? 'free'
  const displayName =
    (user.user_metadata as Record<string, string> | undefined)?.full_name ||
    user.email?.split('@')[0] ||
    'Utilisateur'

  // Sync avec Stripe : si un stripe_subscription_id existe, on vérifie le statut
  // réel pour détecter les annulations que le webhook n'aurait pas encore traitées.
  let subscriptionPeriodEnd = profile?.subscription_period_end ?? null
  let resolvedPlan = plan
  let cancelAtPeriodEnd = false

  // Résolution de l'abonnement Stripe : soit via l'ID stocké en DB,
  // soit via le customer ID (cas où le webhook n'a pas encore mis à jour la DB).
  const stripeSubId = profile?.stripe_subscription_id
  const stripeCustomerId = profile?.stripe_customer_id

  if (stripeSubId || stripeCustomerId) {
    try {
      const stripe = getStripe()
      const admin = createAdminClient()

      let sub: Stripe.Subscription | null = null

      if (stripeSubId) {
        sub = await stripe.subscriptions.retrieve(stripeSubId)
      } else if (stripeCustomerId) {
        // Pas d'ID en DB : on cherche un abonnement actif via le customer
        const list = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          status: 'active',
          limit: 1,
        })
        if (list.data.length > 0) sub = list.data[0]
      }

      if (!sub) {
        console.log('[settings] no active stripe subscription found')
      } else {
        console.log('[settings] stripe sub:', JSON.stringify({
          id: sub.id,
          status: sub.status,
          cancel_at_period_end: sub.cancel_at_period_end,
          cancel_at: sub.cancel_at,
          ended_at: sub.ended_at,
        }))

        if (sub.status === 'canceled' || sub.status === 'incomplete_expired') {
          subscriptionPeriodEnd = null
          resolvedPlan = 'free'
          await admin
            .from('profiles')
            .update({
              plan: 'free',
              stripe_subscription_id: null,
              subscription_period_end: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id)
        } else if (sub.status === 'active' || sub.status === 'trialing') {
          // cancel_at_period_end OU cancel_at (portail Stripe) = abonnement qui ne se renouvelle pas
          cancelAtPeriodEnd = sub.cancel_at_period_end || (sub.cancel_at != null && sub.cancel_at > 0)
          // Si cancel_at est défini, c'est la vraie date de fin d'accès
          const periodEnd = sub.cancel_at
            ? sub.cancel_at
            : sub.items?.data?.[0]?.current_period_end
          if (periodEnd) {
            subscriptionPeriodEnd = new Date(periodEnd * 1000).toISOString()
          }
          // Sync complète si la DB est désynchronisée (webhook manqué)
          const dbOutOfSync =
            resolvedPlan !== 'complete' ||
            profile?.stripe_subscription_id !== sub.id ||
            profile?.subscription_period_end !== subscriptionPeriodEnd
          if (dbOutOfSync) {
            await admin
              .from('profiles')
              .update({
                plan: 'complete',
                stripe_subscription_id: sub.id,
                subscription_period_end: subscriptionPeriodEnd,
                updated_at: new Date().toISOString(),
              })
              .eq('id', user.id)
            resolvedPlan = 'complete'
          }
        }
      }
    } catch (e) {
      console.error('[settings] stripe subscription sync:', e)
    }
  }

  return (
    <SettingsClient
      displayName={displayName}
      email={user.email ?? ''}
      createdAt={user.created_at}
      plan={resolvedPlan}
      stripeCustomerId={profile?.stripe_customer_id ?? null}
      subscriptionPeriodEnd={subscriptionPeriodEnd}
      cancelAtPeriodEnd={cancelAtPeriodEnd}
      checkoutFlash={checkoutFlash}
    />
  )
}
