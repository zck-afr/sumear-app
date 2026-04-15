import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    stripeClient = new Stripe(key)
  }
  return stripeClient
}

export function getPriceIdMonthly(): string | null {
  return process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY?.trim() || null
}

export function getPriceIdYearly(): string | null {
  return process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY?.trim() || null
}

export type BillingInterval = 'monthly' | 'yearly'

export function priceIdForBilling(interval: BillingInterval): string | null {
  return interval === 'yearly' ? getPriceIdYearly() : getPriceIdMonthly()
}

export async function createCheckoutSession(params: {
  userId: string
  userEmail?: string | null
  priceId: string
  successUrl: string
  cancelUrl: string
  existingCustomerId?: string | null
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe()

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    client_reference_id: params.userId,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    allow_promotion_codes: true,
    metadata: { supabase_user_id: params.userId },
    subscription_data: {
      metadata: { supabase_user_id: params.userId },
    },
  }

  if (params.existingCustomerId) {
    sessionParams.customer = params.existingCustomerId
  } else if (params.userEmail) {
    sessionParams.customer_email = params.userEmail
  }

  return stripe.checkout.sessions.create(sessionParams)
}

export async function createBillingPortalSession(params: {
  customerId: string
  returnUrl: string
}): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe()
  return stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  })
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set')
  return secret
}
