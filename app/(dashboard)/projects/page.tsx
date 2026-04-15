import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { ProjectCard, type Project } from './project-card-client'
import { NewProjectButton } from './new-project-button'

const fraunces = 'var(--font-fraunces), serif'
const jakarta  = 'var(--font-plus-jakarta-sans), sans-serif'

async function deleteProject(id: string) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('projects').delete().eq('id', id).eq('user_id', user.id)
  revalidatePath('/projects')
}


export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, emoji, description, created_at, updated_at, clips(id, product_name, price, image_url)')
    .eq('user_id', user!.id)
    .order('updated_at', { ascending: false })

  const projectList = (projects ?? []) as unknown as Project[]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{
            display: 'block',
            fontFamily: fraunces,
            fontSize: 36, fontWeight: 300, fontStyle: 'italic',
            color: 'var(--text-primary)',
            letterSpacing: '-.4px', lineHeight: 1.1,
          }}>
            Projets,
          </span>
          <span style={{
            display: 'block',
            fontFamily: fraunces,
            fontSize: 22, fontWeight: 300,
            color: 'var(--accent)',
            lineHeight: 1.1,
          }}>
            vos listes d&apos;achat 📋
          </span>
          <p style={{
            fontSize: 12, color: 'var(--text-muted)',
            marginTop: 6, marginBottom: 0, fontFamily: jakarta,
          }}>
            Organisez vos produits par projet et demandez conseil à l&apos;IA.
          </p>
        </div>

        <NewProjectButton />
      </div>

      {/* Empty state */}
      {projectList.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 16,
          padding: '60px 0',
        }}>
          <span style={{ fontSize: 48 }}>📋</span>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0, fontFamily: jakarta }}>
            Aucun projet pour l&apos;instant.
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, maxWidth: 320, textAlign: 'center', fontFamily: jakarta }}>
            Créez un projet pour organiser vos produits et demandez conseil à l&apos;IA.
          </p>
          <NewProjectButton label="Créer mon premier projet" />
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginTop: 28,
        }}>
          {projectList.map(project => (
            <ProjectCard key={project.id} project={project} deleteAction={deleteProject} />
          ))}
        </div>
      )}

      <style>{`
        .proj-card:hover { box-shadow: 0 4px 20px rgba(42,30,24,.08); }
        .proj-delete-btn:hover { background: rgba(192,112,112,.15) !important; }
        .proj-delete-btn:hover svg { stroke: #C07070 !important; }
        [data-theme="dark"] .proj-delete-btn { background: transparent; }
        [data-theme="dark"] .proj-card:hover .proj-delete-btn { background: rgba(255,255,255,.12); }
        [data-theme="dark"] .proj-delete-btn:hover { background: rgba(192,112,112,.15) !important; }
      `}</style>
    </div>
  )
}
