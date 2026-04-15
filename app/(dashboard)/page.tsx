import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { RecentClipsGrid } from '@/components/dashboard/recent-clips-grid'
import { Greeting } from '@/components/dashboard/greeting'

export default async function DashboardHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'

  const now = new Date()
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { count: clipsCount } = await supabase
    .from('clips')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const { count: weeklyClipsCount } = await supabase
    .from('clips')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)
    .gte('created_at', weekStart)

  const { data: recentClips } = await supabase
    .from('clips')
    .select('id, product_name, brand, price, currency, image_url, source_domain, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(6)

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, description, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { count: chatSessionsCount } = await supabase
    .from('chat_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const sectionLabel: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: 'var(--ds-text-secondary)',
  }

  const statCard: React.CSSProperties = {
    background: 'var(--ds-bg-card)',
    border: '0.5px solid var(--ds-border-12)',
    borderLeft: '3px solid var(--ds-accent)',
    borderRadius: '0 14px 14px 0',
    padding: '18px 20px',
    flex: 1,
    minWidth: 160,
  }

  const statLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
    color: 'var(--ds-text-muted)',
  }

  const displayFont = 'var(--font-playfair-display), Georgia, serif'

  return (
    <>
      {/* ── Page title ── */}
      <Greeting firstName={firstName} />

      {/* ── Stat cards ── */}
      <div className="flex flex-wrap" style={{ gap: 40, marginTop: 24 }}>

        <div style={statCard}>
          <p style={statLabel}>Produits analysés</p>
          <p style={{ fontFamily: displayFont, fontSize: 36, fontWeight: 400, color: 'var(--ds-text-primary)', marginTop: 8, lineHeight: 1 }}>
            {clipsCount ?? 0}
          </p>
          {(weeklyClipsCount ?? 0) > 0 && (
            <p style={{ fontSize: 12, color: 'var(--ds-green)', fontWeight: 500, marginTop: 8 }}>
              +{weeklyClipsCount} cette semaine
            </p>
          )}
        </div>

        <div style={statCard}>
          <p style={statLabel}>Projets actifs</p>
          <p style={{ fontFamily: displayFont, fontSize: 36, fontWeight: 400, color: 'var(--ds-text-primary)', marginTop: 8, lineHeight: 1 }}>
            {projects?.length ?? 0}
          </p>
          <p style={{ fontSize: 12, color: 'var(--ds-text-muted)', marginTop: 8 }}>
            en cours
          </p>
        </div>

        <div style={statCard}>
          <p style={statLabel}>Discussions</p>
          <p style={{ fontFamily: displayFont, fontSize: 36, fontWeight: 400, color: 'var(--ds-text-primary)', marginTop: 8, lineHeight: 1 }}>
            {chatSessionsCount ?? 0}
          </p>
          <p style={{ fontSize: 12, color: 'var(--ds-text-muted)', marginTop: 8 }}>
            depuis le début
          </p>
        </div>
      </div>

      {/* ── Récemment analysés ── */}
      <div style={{ marginTop: 52 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <p style={sectionLabel}>Récemment analysés</p>
          <Link href="/clips" style={{ fontSize: 13, color: 'var(--ds-accent)', textDecoration: 'none' }} className="hover:opacity-70 transition-opacity">
            Voir tout
          </Link>
        </div>

        {!recentClips || recentClips.length === 0 ? (
          <div
            className="flex items-center justify-center"
            style={{ background: 'var(--ds-bg-card)', border: '0.5px dashed var(--ds-border-20)', borderRadius: 14, padding: 34 }}
          >
            <p style={{ fontSize: 14, color: 'var(--ds-text-muted)', textAlign: 'center' }}>
              Aucun produit encore. Utilisez l&apos;extension Chrome pour analyser des produits.
            </p>
          </div>
        ) : (
          <RecentClipsGrid clips={recentClips} />
        )}
      </div>

      {/* ── Projets en cours ── */}
      <div style={{ marginTop: 52 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <p style={sectionLabel}>Projets en cours</p>
          <Link href="/projects" style={{ fontSize: 13, color: 'var(--ds-accent)', textDecoration: 'none' }} className="hover:opacity-70 transition-opacity">
            Voir tout
          </Link>
        </div>

        {!projects || projects.length === 0 ? (
          <div
            className="flex items-center justify-center"
            style={{ background: 'var(--ds-bg-card)', border: '0.5px dashed var(--ds-border-20)', borderRadius: 14, padding: 34 }}
          >
            <p style={{ fontSize: 14, color: 'var(--ds-text-muted)', textAlign: 'center' }}>
              Aucun projet. Créez-en un pour organiser vos produits.
            </p>
          </div>
        ) : (
          <div className="flex overflow-x-auto scrollbar-hide" style={{ gap: 14, paddingBottom: 4 }}>
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                style={{
                  minWidth: 220,
                  background: 'var(--ds-bg-card)',
                  border: '0.5px solid var(--ds-border-10)',
                  borderRadius: 14,
                  padding: '16px 18px',
                  flexShrink: 0,
                  textDecoration: 'none',
                  display: 'block',
                  transition: 'border-color .15s',
                }}
                className="hover:border-[var(--ds-accent)]/40"
              >
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ds-text-primary)' }}>{project.name}</p>
                {project.description && (
                  <p
                    style={{
                      fontSize: 13,
                      color: 'var(--ds-text-muted)',
                      marginTop: 4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {project.description}
                  </p>
                )}
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: 12,
                    background: 'var(--ds-bg-tag)',
                    color: 'var(--ds-text-tag)',
                    fontSize: 11,
                    fontWeight: 500,
                    borderRadius: 20,
                    padding: '3px 10px',
                  }}
                >
                  en cours
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
