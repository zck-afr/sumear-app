// components/marketing/hero-section.tsx

import type { Locale } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/dictionaries/fr';

const CHROME_STORE_URL = '#';

interface HeroSectionProps {
  lang: Locale;
  dict: Dictionary;
}

export function HeroSection({ lang: _lang, dict }: HeroSectionProps) {
  const h = dict.hero;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            #hero .hero-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 64px;
              align-items: center;
            }
            #hero .hero-headline em {
              font-style: italic;
              color: var(--accent);
            }
            @media (max-width: 768px) {
              #hero .hero-grid {
                grid-template-columns: 1fr;
                gap: 40px;
              }
              #hero .hero-h1 {
                font-size: 40px !important;
              }
            }
          `,
        }}
      />
      <section
        id="hero"
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '80px 48px 64px',
        }}
      >
        <div className="hero-grid">
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                color: 'var(--accent)',
                marginBottom: 16,
                fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
              }}
            >
              {h.eyebrow}
            </p>
            <h1
              className="hero-h1"
              style={{
                fontFamily: 'var(--font-fraunces), Fraunces, serif',
                fontSize: 52,
                fontWeight: 300,
                lineHeight: 1.1,
                letterSpacing: '-0.5px',
                color: 'var(--text-primary)',
                marginBottom: 20,
                marginTop: 0,
              }}
              dangerouslySetInnerHTML={{ __html: h.headline }}
            />
            <p
              style={{
                fontSize: 16,
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                marginBottom: 32,
                maxWidth: 420,
                fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
              }}
            >
              {h.lead}
            </p>
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <a
                href={CHROME_STORE_URL}
                style={{
                  padding: '13px 28px',
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: 28,
                  fontSize: 14,
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                {h.ctaPrimary}
              </a>
              <a
                href="#features"
                style={{
                  fontSize: 13,
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  textDecoration: 'none',
                  fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
                }}
              >
                {h.ctaGhost}
              </a>
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 20,
              border: '0.5px solid var(--border-md)',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(42,30,24,.12)',
            }}
          >
            <div
              style={{
                background: '#2A1E18',
                height: 36,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '0 14px',
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#E85050',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#E8B250',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#50A850',
                  flexShrink: 0,
                }}
              />
            </div>
            <div
              style={{
                padding: 20,
                background: 'var(--bg-page)',
              }}
            >
              <div
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 12,
                  border: '0.5px solid var(--border-md)',
                  padding: 12,
                  marginBottom: 10,
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background: 'var(--bg-secondary)',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 4,
                      background: 'var(--bg-secondary)',
                      marginBottom: 4,
                      width: '80%',
                    }}
                  />
                  <div
                    style={{
                      height: 8,
                      borderRadius: 4,
                      background: 'var(--bg-secondary)',
                      marginBottom: 4,
                      width: '55%',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-playfair-display), "Playfair Display", serif',
                      fontSize: 14,
                      color: 'var(--accent)',
                    }}
                  >
                    189 €
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '4px 0',
                }}
              >
                <div
                  style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    borderRadius: '4px 14px 14px 14px',
                    padding: '10px 13px',
                    fontSize: 11,
                    lineHeight: 1.6,
                    maxWidth: '85%',
                    fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
                  }}
                >
                  {h.mockMessage1}
                </div>
                <div
                  style={{
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    borderRadius: '14px 4px 14px 14px',
                    padding: '8px 11px',
                    fontSize: 11,
                    maxWidth: '70%',
                    marginLeft: 'auto',
                    fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
                  }}
                >
                  {h.mockQuestion}
                </div>
                <div
                  style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    borderRadius: '4px 14px 14px 14px',
                    padding: '10px 13px',
                    fontSize: 11,
                    lineHeight: 1.6,
                    maxWidth: '85%',
                    fontFamily: 'var(--font-plus-jakarta-sans), Plus Jakarta Sans, sans-serif',
                  }}
                >
                  {h.mockMessage2}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
