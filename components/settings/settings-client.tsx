'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/theme-provider'
import { createClient } from '@/lib/supabase/client'

const fraunces = 'var(--font-fraunces), Georgia, serif'
const jakarta = 'var(--font-plus-jakarta-sans), sans-serif'

function isPaidPlan(plan: string): boolean {
  return plan === 'complete' || plan === 'pro'
}

function getLocaleFromCookie(): 'fr' | 'en' {
  if (typeof document === 'undefined') return 'fr'
  const match = document.cookie.match(/sumear-locale=(fr|en)/)
  return match ? (match[1] as 'fr' | 'en') : 'fr'
}

function setLocaleCookie(lang: 'fr' | 'en') {
  document.cookie = `sumear-locale=${lang}; path=/; max-age=31536000; SameSite=Lax`
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 14,
  border: '0.5px solid var(--border-md)',
  padding: '20px 24px',
}

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  color: 'var(--text-secondary)',
  marginBottom: 12,
  fontFamily: jakarta,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 0',
  borderBottom: '0.5px solid var(--border)',
}

const rowLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-secondary)',
  fontFamily: jakarta,
}

const rowValueStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-primary)',
  fontWeight: 500,
  fontFamily: jakarta,
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface SettingsClientProps {
  displayName: string
  email: string
  createdAt: string
  plan: string
  stripeCustomerId: string | null
  subscriptionPeriodEnd: string | null
  cancelAtPeriodEnd?: boolean
  checkoutFlash: 'success' | 'cancel' | null
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SettingsClient({
  displayName,
  email,
  createdAt: _createdAt,
  plan,
  stripeCustomerId,
  subscriptionPeriodEnd,
  cancelAtPeriodEnd = false,
  checkoutFlash,
}: SettingsClientProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'

  const [loading, setLoading] = useState<'checkout-m' | 'portal' | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [lang, setLang] = useState<'fr' | 'en'>('fr')

  // Name editing
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(displayName)
  const [nameSaving, setNameSaving] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const paid = isPaidPlan(plan)
  const expiring = paid && cancelAtPeriodEnd

  useEffect(() => {
    setLang(getLocaleFromCookie())
  }, [])

  useEffect(() => {
    if (checkoutFlash === 'success') {
      setBanner('Paiement reçu. Votre plan Complete sera actif dans quelques secondes.')
      router.replace('/settings', { scroll: false })
    } else if (checkoutFlash === 'cancel') {
      setBanner('Paiement annulé.')
      router.replace('/settings', { scroll: false })
    }
  }, [checkoutFlash, router])

  // ── Stripe ─────────────────────────────────────────────────────────────────

  async function startCheckout() {
    setLoading('checkout-m')
    try {
      const r = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ billing: 'monthly' }),
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
      const r = await fetch('/api/stripe/portal', {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await r.json().catch(() => ({}))
      if (data.url) window.location.assign(data.url)
      else setBanner(data.error || 'Portail indisponible.')
    } finally {
      setLoading(null)
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  function toggleTheme() {
    setTheme(isDark ? 'light' : 'dark')
  }

  function switchLang(next: 'fr' | 'en') {
    if (next === lang) return
    setLang(next)
    setLocaleCookie(next)
  }

  function startEditName() {
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  function cancelEditName() {
    setEditingName(false)
    setNameValue(displayName)
  }

  async function saveName() {
    const trimmed = nameValue.trim().slice(0, 100)
    if (!trimmed || trimmed === displayName) {
      setEditingName(false)
      return
    }
    setNameSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        data: { full_name: trimmed },
      })
      if (error) {
        setBanner('Impossible de mettre à jour le nom.')
      } else {
        router.refresh()
        setEditingName(false)
      }
    } finally {
      setNameSaving(false)
    }
  }

  function handleSubscriptionBtn() {
    if (paid && stripeCustomerId) return openPortal()
    return startCheckout()
  }

  const isLoading = loading !== null
  const subscriptionBtnLabel = isLoading
    ? 'Redirection…'
    : paid
      ? 'Gérer mon abonnement →'
      : 'Passer au plan Complet →'

  return (
    <div style={{ fontFamily: jakarta }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: fraunces,
            fontWeight: 300,
            fontStyle: 'italic',
            fontSize: 34,
            lineHeight: 1.1,
            letterSpacing: '-0.4px',
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Paramètres,
        </h1>
        <div
          style={{
            fontFamily: fraunces,
            fontWeight: 300,
            fontStyle: 'normal',
            fontSize: 20,
            color: 'var(--accent)',
            marginTop: 2,
          }}
        >
          votre compte 👤
        </div>
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            marginTop: 6,
            marginBottom: 0,
            fontFamily: jakarta,
          }}
        >
          Gérez votre compte, abonnement et préférences.
        </p>
      </div>

      {/* ── Flash banner ── */}
      {banner && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 12,
            color: 'var(--text-primary)',
            background: 'var(--accent-light)',
            border: '0.5px solid var(--border-md)',
            fontFamily: jakarta,
          }}
        >
          {banner}
        </div>
      )}

      {/* ══════════════════════════════════════════
          SECTION 1 — Compte
      ══════════════════════════════════════════ */}
      <div style={sectionLabel}>Compte</div>
      <div style={cardStyle}>
        {/* Email row */}
        <div style={rowStyle}>
          <span style={rowLabelStyle}>Email</span>
          <span style={rowValueStyle}>{email}</span>
        </div>
        {/* Nom row — editable, no border-bottom on last */}
        <div style={{ ...rowStyle, borderBottom: 'none', gap: 12 }}>
          <span style={rowLabelStyle}>Nom</span>
          {editingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                ref={nameInputRef}
                value={nameValue}
                maxLength={100}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName()
                  if (e.key === 'Escape') cancelEditName()
                }}
                disabled={nameSaving}
                style={{
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  fontFamily: jakarta,
                  background: 'var(--bg-secondary)',
                  border: '0.5px solid var(--border-md)',
                  borderRadius: 8,
                  padding: '4px 10px',
                  outline: 'none',
                  width: 180,
                  opacity: nameSaving ? 0.6 : 1,
                }}
              />
              <button
                onClick={saveName}
                disabled={nameSaving}
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '4px 12px',
                  borderRadius: 20,
                  border: 'none',
                  cursor: nameSaving ? 'wait' : 'pointer',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontFamily: jakarta,
                  opacity: nameSaving ? 0.6 : 1,
                }}
              >
                {nameSaving ? '…' : 'Enregistrer'}
              </button>
              <button
                onClick={cancelEditName}
                disabled={nameSaving}
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '4px 12px',
                  borderRadius: 20,
                  border: '0.5px solid var(--border-md)',
                  cursor: 'pointer',
                  background: 'none',
                  color: 'var(--text-secondary)',
                  fontFamily: jakarta,
                }}
              >
                Annuler
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={rowValueStyle}>{nameValue}</span>
              <button
                onClick={startEditName}
                title="Modifier le nom"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 2,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SECTION 2 — Abonnement
      ══════════════════════════════════════════ */}
      <div style={{ ...sectionLabel, marginTop: 20 }}>Abonnement</div>
      <div style={cardStyle}>
        {/* Card header: plan name + badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text-primary)',
              fontFamily: jakarta,
            }}
          >
            {paid ? 'Plan Complet' : 'Plan Free'}
          </span>
          {paid && !expiring ? (
            <span
              style={{
                background: 'linear-gradient(135deg, #C8A882, #B8715A)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 500,
                padding: '4px 12px',
                borderRadius: 20,
                fontFamily: jakarta,
              }}
            >
              ✦ Complet
            </span>
          ) : expiring ? (
            <span
              style={{
                background: 'rgba(184,113,90,.12)',
                color: '#B8715A',
                border: '0.5px solid rgba(184,113,90,.35)',
                fontSize: 11,
                fontWeight: 500,
                padding: '4px 12px',
                borderRadius: 20,
                fontFamily: jakarta,
              }}
            >
              {subscriptionPeriodEnd
                ? `Complet jusqu'au ${new Date(subscriptionPeriodEnd).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`
                : 'Non renouvelé'}
            </span>
          ) : (
            <span
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                fontSize: 11,
                fontWeight: 500,
                padding: '4px 12px',
                borderRadius: 20,
                fontFamily: jakarta,
              }}
            >
              Free
            </span>
          )}
        </div>

        {/* Info rows */}
          {paid ? (
            <>
              <div style={rowStyle}>
                <span style={rowLabelStyle}>
                  {expiring ? 'Accès jusqu\'au' : 'Renouvellement'}
                </span>
                <span style={{ ...rowValueStyle, color: expiring ? '#B8715A' : undefined }}>
                  {subscriptionPeriodEnd
                    ? new Date(subscriptionPeriodEnd).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })
                    : '—'}
                </span>
              </div>
            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <span style={rowLabelStyle}>Facturation</span>
              <span style={rowValueStyle}>12,90 € / mois</span>
            </div>
          </>
        ) : (
          <div style={{ ...rowStyle, borderBottom: 'none' }}>
            <span style={rowLabelStyle}>Facturation</span>
            <span style={rowValueStyle}>Gratuit</span>
          </div>
        )}

        {/* Action button */}
        <div style={{ marginTop: 14 }}>
          <button
            onClick={handleSubscriptionBtn}
            disabled={isLoading}
            style={{
              background: paid ? 'none' : 'var(--accent)',
              border: paid ? '1px solid var(--border-md)' : 'none',
              color: paid ? 'var(--text-secondary)' : '#fff',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              padding: '9px 18px',
              cursor: isLoading ? 'wait' : 'pointer',
              fontFamily: jakarta,
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {subscriptionBtnLabel}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SECTION 3 — Préférences
      ══════════════════════════════════════════ */}
      <div style={{ ...sectionLabel, marginTop: 20 }}>Préférences</div>
      <div style={cardStyle}>
        {/* Row 1 — Thème */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 0',
            borderBottom: '0.5px solid var(--border)',
          }}
        >
          <div>
            <div style={rowLabelStyle}>Thème</div>
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                marginTop: 1,
                fontFamily: jakarta,
              }}
            >
              Clair ou sombre
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Sun icon */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="2.5" stroke="var(--text-muted)" strokeWidth="1.5" />
              <line x1="11" y1="7" x2="12.5" y2="7" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="9.83" y1="9.83" x2="10.89" y2="10.89" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="7" y1="11" x2="7" y2="12.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="4.17" y1="9.83" x2="3.11" y2="10.89" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="3" y1="7" x2="1.5" y2="7" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="4.17" y1="4.17" x2="3.11" y2="3.11" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="7" y1="3" x2="7" y2="1.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="9.83" y1="4.17" x2="10.89" y2="3.11" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {/* Toggle track */}
            <div
              role="switch"
              aria-checked={isDark}
              onClick={toggleTheme}
              style={{
                width: 40,
                height: 22,
                borderRadius: 20,
                background: isDark ? 'var(--accent)' : 'var(--bg-secondary)',
                border: '0.5px solid var(--border-md)',
                position: 'relative',
                cursor: 'pointer',
                opacity: isDark ? 0.6 : 1,
                transition: 'background .2s, opacity .2s',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: 'var(--bg-card)',
                  position: 'absolute',
                  top: 3,
                  left: 3,
                  boxShadow: '0 1px 3px rgba(0,0,0,.15)',
                  transition: 'transform .2s',
                  transform: isDark ? 'translateX(18px)' : 'translateX(0)',
                }}
              />
            </div>
            {/* Moon icon */}
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M 10 3 A 7 7 0 1 0 17 10 A 5 5 0 1 1 10 3 Z"
                stroke="var(--text-muted)" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Row 2 — Langue */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 0',
          }}
        >
          <span style={rowLabelStyle}>Langue</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['fr', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => switchLang(l)}
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '4px 12px',
                  borderRadius: 20,
                  border: 'none',
                  cursor: 'pointer',
                  background:
                    lang === l ? 'var(--accent-light)' : 'var(--bg-secondary)',
                  color:
                    lang === l ? 'var(--tag-text)' : 'var(--text-secondary)',
                  fontFamily: jakarta,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SECTION 4 — Zone sensible
      ══════════════════════════════════════════ */}
      <div style={{ ...sectionLabel, marginTop: 20, color: '#C07070' }}>
        Zone sensible
      </div>
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 14,
          border: '1px solid rgba(192,112,112,.25)',
          padding: '20px 24px',
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#C07070',
            marginBottom: 4,
            fontFamily: jakarta,
          }}
        >
          Supprimer mon compte
        </div>
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            margin: '0 0 14px',
            fontFamily: jakarta,
          }}
        >
          Cette action est irréversible. Toutes vos données (clips, projets,
          historique) seront définitivement supprimées.
        </p>
        <button
          type="button"
          style={{
            background: 'none',
            border: '1px solid #C07070',
            color: '#C07070',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500,
            padding: '9px 18px',
            cursor: 'pointer',
            fontFamily: jakarta,
          }}
        >
          Supprimer mon compte
        </button>
      </div>

    </div>
  )
}
