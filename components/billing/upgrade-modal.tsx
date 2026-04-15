'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PLAN_LIMITS } from '@/lib/config/plans'

type BillingInterval = 'monthly' | 'yearly'

async function postCheckout(billing: BillingInterval): Promise<string | null> {
  const r = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ billing }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    console.error('[upgrade]', data)
    return null
  }
  return typeof data.url === 'string' ? data.url : null
}

function redirectToCheckout(url: string, useTopWindow: boolean) {
  if (useTopWindow && typeof window !== 'undefined' && window.top && window.top !== window.self) {
    window.top.location.assign(url)
  } else {
    window.location.assign(url)
  }
}

export function UpgradeModal({
  open,
  onOpenChange,
  title,
  description,
  embedTopRedirect = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  /** Iframe embed : rediriger la fenêtre parente vers Stripe */
  embedTopRedirect?: boolean
}) {
  const [loading, setLoading] = useState<BillingInterval | null>(null)

  const defaultTitle = 'Passe au Complete'
  const defaultDescription = `Tu as atteint une limite du plan Free (${PLAN_LIMITS.free.ai_messages_per_month} messages IA / mois, ${PLAN_LIMITS.free.clips_total} clips, ${PLAN_LIMITS.free.projects_total} projets). Avec Complete : ${PLAN_LIMITS.complete.ai_messages_per_month} messages IA / mois, clips et projets illimités, modèle Sonnet.`

  async function onCheckout(billing: BillingInterval) {
    setLoading(billing)
    try {
      const url = await postCheckout(billing)
      if (url) redirectToCheckout(url, embedTopRedirect)
    } finally {
      setLoading(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#393E46] bg-[#23262A] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">{title ?? defaultTitle}</DialogTitle>
          <DialogDescription className="text-[#aaa]">
            {description ?? defaultDescription}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Button
            className="w-full bg-[#B8715A] hover:bg-[#a0654f] text-white"
            disabled={loading !== null}
            onClick={() => onCheckout('monthly')}
          >
            {loading === 'monthly' ? 'Redirection…' : 'Complete — 12,90 € / mois'}
          </Button>
          <Button
            variant="outline"
            className="w-full border-[#555] bg-transparent text-white hover:bg-white/10"
            disabled={loading !== null}
            onClick={() => onCheckout('yearly')}
          >
            {loading === 'yearly' ? 'Redirection…' : 'Complete — 118,80 € / an (9,90 € / mois)'}
          </Button>
        </div>
        <DialogFooter className="sm:justify-start">
          <button
            type="button"
            className="text-xs text-[#888] hover:text-[#aaa] underline-offset-2 hover:underline"
            onClick={() => onOpenChange(false)}
          >
            Plus tard
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
