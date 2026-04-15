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
      setBanner('Paiement reçu. Ton plan Complete sera actif dans quelques secondes.')
      router.replace('/settings', { scroll: false })
    } else if (checkoutFlash === 'cancel') {
      setBanner('Paiement annulé.')
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
      else setBanner(data.error || 'Impossible de démarrer le paiement.')
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
      else setBanner(data.error || 'Portail indisponible.')
    } finally {
      setLoading(null)
    }
  }

  const paid = isPaidPlan(plan)

  return (
    <div className="mt-4 rounded-xl bg-[#393E46] border border-[#393E46] p-5">
      <h2 className="text-sm font-semibold text-white">Abonnement</h2>

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
                ? 'Messages IA, clips et projets selon le plan Complete. Gère le renouvellement ou l’annulation via Stripe.'
                : `Free : ${PLAN_LIMITS.free.ai_messages_per_month} messages IA/mois, ${PLAN_LIMITS.free.clips_total} clips, ${PLAN_LIMITS.free.projects_total} projets. Complete : ${PLAN_LIMITS.complete.ai_messages_per_month} messages/mois, illimité clips & projets.`}
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
              {loading === 'checkout-m' ? 'Redirection…' : 'Passer au Complete — 12,90 €/mois'}
            </Button>
            <Button
              variant="outline"
              className="border-[#555] text-white hover:bg-white/10 bg-transparent"
              disabled={loading !== null}
              onClick={() => startCheckout('yearly')}
            >
              {loading === 'checkout-y' ? 'Redirection…' : 'Annuel — 118,80 €/an'}
            </Button>
          </div>
        ) : stripeCustomerId ? (
          <Button
            variant="outline"
            className="border-[#555] text-white hover:bg-white/10 bg-transparent"
            disabled={loading !== null}
            onClick={openPortal}
          >
            {loading === 'portal' ? 'Redirection…' : 'Gérer mon abonnement'}
          </Button>
        ) : (
          <p className="text-xs text-[#888]">
            Abonnement actif — si tu dois gérer la facturation, contacte le support (client Stripe non lié au profil).
          </p>
        )}
      </div>
    </div>
  )
}
