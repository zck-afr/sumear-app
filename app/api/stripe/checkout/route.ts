import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession, priceIdForBilling, type BillingInterval } from '@/lib/stripe'
import { trustedAppOrigin } from '@/lib/stripe-app-origin'

/**
 * POST /api/stripe/checkout
 * Body: { billing?: "monthly" | "yearly" }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    let body: { billing?: string } = {}
    try {
      body = await request.json()
    } catch {
      /* default monthly */
    }

    const billing: BillingInterval = body.billing === 'yearly' ? 'yearly' : 'monthly'
    const priceId = priceIdForBilling(billing)
    if (!priceId) {
      return NextResponse.json(
        { error: 'Stripe price IDs are not configured', code: 'STRIPE_NOT_CONFIGURED' },
        { status: 500 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, stripe_customer_id, stripe_subscription_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.plan === 'complete' && profile?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'Vous avez déjà un abonnement actif. Gérez-le depuis les paramètres.', code: 'ALREADY_SUBSCRIBED' },
        { status: 409 }
      )
    }

    const origin = trustedAppOrigin(request)
    const session = await createCheckoutSession({
      userId: user.id,
      userEmail: user.email,
      priceId,
      existingCustomerId: profile?.stripe_customer_id ?? null,
      successUrl: `${origin}/settings?checkout=success`,
      cancelUrl: `${origin}/settings?checkout=cancel`,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'No checkout URL', code: 'STRIPE_ERROR' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (e: unknown) {
    console.error('[stripe checkout]', e)
    return NextResponse.json({ error: 'Checkout failed', code: 'STRIPE_ERROR' }, { status: 500 })
  }
}
