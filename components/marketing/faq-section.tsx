// components/marketing/faq-section.tsx
'use client';

// ─────────────────────────────────────────────
// FAQ accordion. Pure CSS + React state, no dependencies.
// ─────────────────────────────────────────────

import { useState } from 'react';
import type { Dictionary } from '@/lib/i18n/dictionaries/fr';

interface FaqSectionProps {
  dict: Dictionary;
}

export function FaqSection({ dict }: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '64px 24px 80px',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-fraunces), Fraunces, serif',
          fontSize: 32,
          fontWeight: 600,
          textAlign: 'center',
          marginBottom: 40,
        }}
      >
        {dict.faq.title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {dict.faq.items.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={i}
              style={{
                background: 'var(--bg-card)',
                borderRadius: 12,
                border: '1px solid var(--bg-sidebar)',
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '18px 24px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                  fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
                }}
              >
                {item.q}
                <span
                  style={{
                    fontSize: 18,
                    transition: 'transform 200ms ease',
                    transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                    flexShrink: 0,
                    marginLeft: 16,
                  }}
                >
                  +
                </span>
              </button>
              <div
                style={{
                  maxHeight: isOpen ? 300 : 0,
                  overflow: 'hidden',
                  transition: 'max-height 300ms ease',
                }}
              >
                <p
                  style={{
                    padding: '0 24px 18px',
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: 'var(--text-secondary)',
                    margin: 0,
                    fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
                  }}
                >
                  {item.a}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
