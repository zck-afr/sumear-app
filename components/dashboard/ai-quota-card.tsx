'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const playfair = 'var(--font-playfair-display), Georgia, serif'
const jakarta  = 'var(--font-plus-jakarta-sans), sans-serif'
const ARC_LENGTH = 97

function nextResetLabel(): string {
  const now  = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return `1 ${next.toLocaleDateString('fr-FR', { month: 'long' })}`
}

interface Props {
  aiUsed: number
  /** null = unlimited (complete plan) */
  aiLimit: number | null
  billingPlan: 'free' | 'complete'
}

export function AiQuotaCard({ aiUsed, aiLimit, billingPlan }: Props) {
  const unlimited    = aiLimit === null
  const targetOffset = unlimited ? 0 : ARC_LENGTH - (aiUsed / aiLimit!) * ARC_LENGTH

  // Animate from empty arc on mount
  const [offset, setOffset] = useState(ARC_LENGTH)
  useEffect(() => {
    const id = setTimeout(() => setOffset(targetOffset), 60)
    return () => clearTimeout(id)
  }, [targetOffset])

  const planName = billingPlan === 'free' ? 'Gratuit' : 'Complet'
  const resetLabel = nextResetLabel()

  return (
    <div style={{
      background: 'var(--ds-bg-card)',
      border: '0.5px solid var(--ds-border-12)',
      borderLeft: '3px solid var(--accent)',
      borderRadius: '0 14px 14px 0',
      padding: '18px 20px',
      flex: 1,
      minWidth: 160,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Label */}
      <p style={{
        fontSize: 10, fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: '.5px',
        color: 'var(--ds-text-muted)',
        margin: 0, alignSelf: 'flex-start',
        fontFamily: jakarta,
      }}>
        Messages envoyés
      </p>

      {/* Arc + number */}
      <div style={{ marginTop: 6, position: 'relative', width: 72, height: 50 }}>
        <svg width="72" height="38" viewBox="0 0 72 38" fill="none">
          <path
            d="M 5 38 A 31 31 0 0 1 67 38"
            stroke="var(--bg-secondary)"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 5 38 A 31 31 0 0 1 67 38"
            stroke="var(--accent)"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={ARC_LENGTH}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: playfair,
          fontSize: 20,
          color: 'var(--text-primary)',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          {aiUsed}
        </div>
      </div>

      {/* Sublabel */}
      <p style={{
        fontSize: 10, color: 'var(--ds-text-muted)',
        textAlign: 'center', margin: '2px 0 0',
        fontFamily: jakarta,
      }}>
        {unlimited
          ? `Plan ${planName} · illimité`
          : `sur ${aiLimit} messages · Plan ${planName}`}
      </p>

      {/* Reset date */}
      {!unlimited && (
        <p style={{
          fontSize: 9, color: 'var(--ds-text-muted)',
          textAlign: 'center', margin: '2px 0 0',
          fontFamily: jakarta,
        }}>
          Réinitialisation le {resetLabel}
        </p>
      )}

      {/* Upgrade link — free plan only */}
      {billingPlan === 'free' && (
        <Link
          href="/settings"
          style={{
            fontSize: 10, color: 'var(--ds-accent)', fontWeight: 500,
            textAlign: 'center', marginTop: 8, display: 'block',
            textDecoration: 'none', fontFamily: jakarta,
          }}
          className="hover:underline"
        >
          Passer au plan Complet →
        </Link>
      )}
    </div>
  )
}
