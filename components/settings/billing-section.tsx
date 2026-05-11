'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PLAN_LIMITS } from '@/lib/config/plans'

type BillingInterval = 'monthly' | 'yearly'

function isPaidPlan(plan: string): boolean {
  return plan === 'complete' || plan === 'pro'
}

export function BillingSection({
  plan,
  stripeCustomerId,
  checkoutFlash,
}: {
  plan: string
  stripeCustomerId: string | null
  checkoutFlash: 'success' | 'cancel' | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<'checkout-m' | 'checkout-y' | 'portal' | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  useEffect(() => {
    if (checkoutFlash === 'success') {
      setBanner('Payment received. Your Complete plan will be active in a few seconds.')
      router.replace('/settings', { scroll: false })
    } else if (checkoutFlash === 'cancel') {
      setBanner('Payment cancelled.')
      router.replace('/settings', { scroll: false })
    }
  }, [checkoutFlash, router])

  async function startCheckout(billing: BillingInterval) {
    setLoading(billing === 'yearly' ? 'checkout-y' : 'checkout-m')
    try {
      const r = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ billing }),
      })
      const data = await r.json().catch(() => ({}))
      if (data.url) window.location.assign(data.url)
      else setBanner(data.error || 'Unable to start checkout.')
    } finally {
      setLoading(null)
    }
  }

  async function openPortal() {
    setLoading('portal')
    try {
      const r = await fetch('/api/stripe/portal', { method: 'POST', credentials: 'same-origin' })
      const data = await r.json().catch(() => ({}))
      if (data.url) window.location.assign(data.url)
      else setBanner(data.error || 'Portal unavailable.')
    } finally {
      setLoading(null)
    }
  }

  const paid = isPaidPlan(plan)

  return (
    <div className="mt-4 rounded-xl bg-[#393E46] border border-[#393E46] p-5">
      <h2 className="text-sm font-semibold text-white">Subscription</h2>

      {banner && (
        <p className="mt-3 text-xs text-amber-200/90 border border-amber-500/25 rounded-lg px-3 py-2 bg-amber-500/10">
          {banner}
        </p>
      )}

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-sm text-white capitalize">{paid ? 'Complete' : 'Free'}</span>
            <p className="text-xs text-[#888] mt-1 max-w-md">
              {paid
                ? 'AI messages, clips, and projects per the Complete plan. Manage renewal or cancellation via Stripe.'
                : `Free: ${PLAN_LIMITS.free.ai_messages_per_month} AI messages/month, ${PLAN_LIMITS.free.clips_total} clips, ${PLAN_LIMITS.free.projects_total} projects. Complete: ${PLAN_LIMITS.complete.ai_messages_per_month} messages/month, unlimited clips & projects.`}
            </p>
          </div>
        </div>

        {!paid ? (
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button
              className="bg-[#B8715A] hover:bg-[#a0654f] text-white"
              disabled={loading !== null}
              onClick={() => startCheckout('monthly')}
            >
              {loading === 'checkout-m' ? 'Redirecting…' : 'Upgrade to Complete — €12.90/month'}
            </Button>
            <Button
              variant="outline"
              className="border-[#555] text-white hover:bg-white/10 bg-transparent"
              disabled={loading !== null}
              onClick={() => startCheckout('yearly')}
            >
              {loading === 'checkout-y' ? 'Redirecting…' : 'Yearly — €118.80/year'}
            </Button>
          </div>
        ) : stripeCustomerId ? (
          <Button
            variant="outline"
            className="border-[#555] text-white hover:bg-white/10 bg-transparent"
            disabled={loading !== null}
            onClick={openPortal}
          >
            {loading === 'portal' ? 'Redirecting…' : 'Manage subscription'}
          </Button>
        ) : (
          <p className="text-xs text-[#888]">
            Active subscription — to manage billing, contact support (Stripe customer not linked to profile).
          </p>
        )}
      </div>
    </div>
  )
}
