// components/marketing/features-section.tsx

import type { Dictionary } from '@/lib/i18n/dictionaries/fr';

interface FeaturesSectionProps {
  dict: Dictionary;
}

export function FeaturesSection({ dict }: FeaturesSectionProps) {
  const f = dict.features;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            #features .features-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 16px;
            }
            @media (max-width: 768px) {
              #features .features-grid {
                grid-template-columns: 1fr;
              }
            }
          `,
        }}
      />
      <section
        id="features"
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '64px 48px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2
            style={{
              fontFamily: 'var(--font-fraunces), Fraunces, serif',
              fontSize: 36,
              fontWeight: 300,
              fontStyle: 'italic',
              color: 'var(--text-primary)',
              marginBottom: 6,
              marginTop: 0,
            }}
          >
            {f.title}
          </h2>
          <p
            style={{
              fontSize: 14,
              color: 'var(--text-muted)',
              marginBottom: 0,
              marginTop: 0,
              fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
            }}
          >
            {f.subtitle}
          </p>
        </div>

        <div className="features-grid">
          {f.items.map((item, i) => (
            <div
              key={i}
              style={{
                background: 'var(--bg-card)',
                borderRadius: 16,
                border: '0.5px solid var(--border-md)',
                padding: 24,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'var(--accent-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
              </div>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                  marginTop: 0,
                  fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  margin: 0,
                  fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
                }}
              >
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
