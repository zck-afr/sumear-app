// components/marketing/pricing-section.tsx
'use client';

// ─────────────────────────────────────────────
// Pricing section with monthly/yearly toggle.
// Free plan → scrolls to Chrome Web Store CTA or triggers OAuth.
// Complete plan → triggers Stripe Checkout via /api/stripe/checkout.
// ─────────────────────────────────────────────

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Locale } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/dictionaries/fr';

interface PricingSectionProps {
  lang: Locale;
  dict: Dictionary;
  /** When true, section sits on a dark (#2A1E18) strip — light text and glassy cards. */
  onDarkBackground?: boolean;
}

const CHROME_STORE_URL = '#';

// Singleton — avoid re-creating on every render/click
// If you already have lib/supabase/client.ts, use that instead.
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function PricingSection({
  lang,
  dict,
  onDarkBackground = false,
}: PricingSectionProps) {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const p = dict.pricing;

  const dark = onDarkBackground;
  const h2Color = dark ? '#F0E0CC' : undefined;
  const cardBg = dark ? 'rgba(255,255,255,.06)' : 'var(--bg-card)';
  const cardBorderFree = dark ? '0.5px solid rgba(255,200,150,.1)' : '1px solid var(--bg-sidebar)';
  const cardBorderComplete = dark ? '2px solid #C8A882' : '2px solid var(--accent)';
  const planNameColor = dark ? 'rgba(255,255,255,.5)' : undefined;
  const priceColor = dark ? '#F0E0CC' : undefined;
  const featureTextColor = dark ? 'rgba(255,255,255,.55)' : 'var(--text-secondary)';
  const perSpanColor = dark ? 'rgba(255,255,255,.45)' : 'var(--text-secondary)';
  const toggleInactiveBg = dark ? 'rgba(255,255,255,.08)' : 'var(--bg-card)';
  const toggleInactiveColor = dark ? 'rgba(255,255,255,.5)' : 'var(--text-secondary)';

  async function handleUpgrade() {
    if (loading) return;
    setLoading(true);

    try {
      // Check if user is logged in first
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Not logged in → trigger OAuth, then redirect to settings to upgrade
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/callback?next=/settings`,
          },
        });
        if (error) console.error('OAuth error:', error.message);
        return;
      }

      // Logged in → create Stripe Checkout session
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billing }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('Checkout error:', data.error);
      }
    } catch (err) {
      console.error('Checkout failed:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      id="pricing"
      style={{
        maxWidth: 1120,
        margin: '0 auto',
        padding: '64px 24px',
        background: dark ? 'transparent' : undefined,
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-fraunces), Fraunces, serif',
          fontSize: 32,
          fontWeight: 600,
          textAlign: 'center',
          marginBottom: 32,
          color: h2Color,
        }}
      >
        {p.title}
      </h2>

      {/* Toggle monthly/yearly */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12,
          marginBottom: 48,
          fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
        }}
      >
        <button
          onClick={() => setBilling('monthly')}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            background:
              billing === 'monthly' ? 'var(--accent)' : toggleInactiveBg,
            color:
              billing === 'monthly' ? '#fff' : toggleInactiveColor,
          }}
        >
          {p.monthly}
        </button>
        <button
          onClick={() => setBilling('yearly')}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            background:
              billing === 'yearly' ? 'var(--accent)' : toggleInactiveBg,
            color:
              billing === 'yearly' ? '#fff' : toggleInactiveColor,
          }}
        >
          {p.yearly}
          <span
            style={{
              marginLeft: 8,
              fontSize: 11,
              background:
                billing === 'yearly'
                  ? 'rgba(255,255,255,0.2)'
                  : dark
                    ? 'rgba(200,168,130,.35)'
                    : 'var(--accent)',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 99,
            }}
          >
            {p.save}
          </span>
        </button>
      </div>

      {/* Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 24,
          maxWidth: 720,
          margin: '0 auto',
        }}
      >
        {/* Free */}
        <div
          style={{
            background: cardBg,
            borderRadius: 16,
            padding: 32,
            border: cardBorderFree,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <h3
            style={{
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 8,
              fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
              color: planNameColor,
            }}
          >
            {p.free.name}
          </h3>
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              marginBottom: 24,
              fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
              color: priceColor,
            }}
          >
            {p.free.price}
          </div>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 32px',
              flex: 1,
            }}
          >
            {p.free.features.map((f, i) => (
              <li
                key={i}
                style={{
                  padding: '8px 0',
                  fontSize: 14,
                  color: featureTextColor,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
                }}
              >
                <span style={{ color: 'var(--accent)' }}>✓</span> {f}
              </li>
            ))}
          </ul>
          <a
            href={CHROME_STORE_URL}
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '12px 24px',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              textDecoration: 'none',
              border: '1.5px solid var(--accent)',
              color: 'var(--accent)',
              fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
            }}
          >
            {p.free.cta}
          </a>
        </div>

        {/* Complete */}
        <div
          style={{
            background: cardBg,
            borderRadius: 16,
            padding: 32,
            border: cardBorderComplete,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          <h3
            style={{
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 8,
              fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
              color: planNameColor,
            }}
          >
            {p.complete.name}
          </h3>
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
              color: priceColor,
            }}
          >
            {billing === 'monthly' ? p.complete.priceMonthly : p.complete.priceYearly}
            <span
              style={{
                fontSize: 16,
                fontWeight: 400,
                color: perSpanColor,
              }}
            >
              {' '}
              {p.perMonth}
            </span>
          </div>
          {billing === 'yearly' && (
            <p
              style={{
                fontSize: 13,
                color: perSpanColor,
                marginTop: 4,
                fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
              }}
            >
              {p.complete.totalYearly} {p.perYear}
            </p>
          )}
          <div style={{ marginBottom: 24 }} />
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 32px',
              flex: 1,
            }}
          >
            {p.complete.features.map((f, i) => (
              <li
                key={i}
                style={{
                  padding: '8px 0',
                  fontSize: 14,
                  color: featureTextColor,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
                }}
              >
                <span style={{ color: 'var(--accent)' }}>✓</span> {f}
              </li>
            ))}
          </ul>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              padding: '12px 24px',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
              fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
            }}
          >
            {p.complete.cta}
          </button>
        </div>
      </div>
    </section>
  );
}
