import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe, getStripeWebhookSecret } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(s: string): boolean {
  return UUID_RE.test(s)
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription') return

  const userId = session.client_reference_id || session.metadata?.supabase_user_id
  if (!userId || !isUuid(userId)) {
    console.error('[stripe] checkout.session.completed: missing or invalid user id', session.id)
    return
  }

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

  if (!customerId || !subscriptionId) {
    console.error('[stripe] checkout.session.completed: missing customer/subscription', session.id)
    return
  }

  // Fetch subscription to verify status and get period end date
  const stripe = getStripe()
  let sub: Stripe.Subscription
  try {
    sub = await stripe.subscriptions.retrieve(subscriptionId)
  } catch (e) {
    console.error('[stripe] checkout: failed to fetch subscription:', e)
    return
  }

  if (sub.status !== 'active' && sub.status !== 'trialing') {
    console.warn('[stripe] checkout: subscription not active/trialing:', sub.id, sub.status)
    return
  }

  const periodEnd = sub.items?.data?.[0]?.current_period_end
  const subscriptionPeriodEnd = periodEnd
    ? new Date(periodEnd * 1000).toISOString()
    : null

  const admin = createAdminClient()
  const { error, data } = await admin
    .from('profiles')
    .update({
      plan: 'complete',
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_period_end: subscriptionPeriodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id')

  if (error) console.error('[stripe] profile update after checkout:', error.message, error)
  if (!data || data.length === 0) console.warn('[stripe] checkout: no profile row found for user', userId)
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      plan: 'free',
      stripe_subscription_id: null,
      subscription_period_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', sub.id)

  if (error) console.error('[stripe] profile downgrade:', error.message, error)
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
  if (!customerId) return

  if (sub.status !== 'active' && sub.status !== 'trialing') {
    if (sub.status === 'unpaid' || sub.status === 'incomplete_expired') {
      console.warn('[stripe] subscription status', sub.id, sub.status)
    }
    return
  }

  // Determine the effective period end date:
  // cancel_at (portal scheduled cancellation) takes precedence over regular period end
  const isCancelling = sub.cancel_at_period_end || (sub.cancel_at != null && sub.cancel_at > 0)
  const rawPeriodEnd = isCancelling && sub.cancel_at
    ? sub.cancel_at
    : sub.items?.data?.[0]?.current_period_end

  const admin = createAdminClient()
  const row = {
    plan: 'complete' as const,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    subscription_period_end: rawPeriodEnd
      ? new Date(rawPeriodEnd * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  }

  const bySub = await admin.from('profiles').update(row).eq('stripe_subscription_id', sub.id).select('id')
  if (bySub.error) {
    console.error('[stripe] subscription.updated (by sub id):', bySub.error.message)
    return
  }
  if (bySub.data && bySub.data.length > 0) return

  const uid = sub.metadata?.supabase_user_id
  if (uid && isUuid(uid)) {
    const byUser = await admin.from('profiles').update(row).eq('id', uid)
    if (byUser.error) console.error('[stripe] subscription.updated (by user id):', byUser.error.message)
  }
}

/**
 * POST /api/webhooks/stripe
 * Configurer l’endpoint dans Stripe Dashboard avec le secret STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, getStripeWebhookSecret())
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'invalid signature'
    console.error('[stripe webhook] signature:', msg)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice
        console.warn('[stripe webhook] invoice.payment_failed', inv?.id ?? '(no id)')
        break
      }
      default:
        break
    }
  } catch (e) {
    console.error('[stripe webhook] handler:', e)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
