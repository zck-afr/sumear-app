import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createBillingPortalSession } from '@/lib/stripe'
import { trustedAppOrigin } from '@/lib/stripe-app-origin'

/** POST /api/stripe/portal — Stripe Customer Portal (gérer / annuler l’abonnement) */
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    const customerId = profile?.stripe_customer_id
    if (!customerId) {
      return NextResponse.json(
        { error: 'No Stripe customer linked. Subscribe to Complete first.', code: 'NO_CUSTOMER' },
        { status: 400 }
      )
    }

    const origin = trustedAppOrigin(request)
    const session = await createBillingPortalSession({
      customerId,
      returnUrl: `${origin}/settings`,
    })

    return NextResponse.json({ url: session.url })
  } catch (e: unknown) {
    console.error('[stripe portal]', e)
    return NextResponse.json({ error: 'Portal failed', code: 'STRIPE_ERROR' }, { status: 500 })
  }
}
