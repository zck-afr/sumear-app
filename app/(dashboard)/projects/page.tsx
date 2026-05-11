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
    .select('*, clips(id, product_name, price, image_url)')
    .eq('user_id', user!.id)
    .order('updated_at', { ascending: false })

  const projectList = (projects ?? []) as unknown as Project[]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <span style={{
            display: 'block',
            fontFamily: fraunces,
            fontSize: 36, fontWeight: 300, fontStyle: 'normal',
            color: 'var(--text-primary)',
            letterSpacing: '-.4px', lineHeight: 1.1,
          }}>
            Projects
          </span>
        </div>

        <NewProjectButton />
      </div>

      {/* Empty state — centered horizontally, short space below header */}
      {projectList.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            marginTop: 260,
            gap: 12,
          }}
        >
          <span style={{
            fontFamily: fraunces,
            fontSize: 22,
            fontWeight: 300,
            fontStyle: 'normal',
            color: 'var(--text-primary)',
            letterSpacing: '-.2px',
          }}>
            No projects yet.
          </span>
          <p style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            maxWidth: 280,
            margin: '0 auto',
            fontFamily: jakarta,
          }}>
            Create a project to organise your products and get AI advice.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 28,
          marginTop: 56,
        }}>
          {projectList.map((project, listIndex) => (
            <ProjectCard key={project.id} project={project} listIndex={listIndex} deleteAction={deleteProject} />
          ))}
        </div>
      )}

      <style>{`
        .proj-card:hover { box-shadow: 0 4px 20px rgba(42,30,24,.08); }
        /* Icône poubelle : crème light (--bg-card), crème chaud lisible en dark */
        .proj-delete-btn { color: var(--bg-card); }
        [data-theme="dark"] .proj-delete-btn { color: rgba(240, 237, 232, 0.9); }
        .proj-delete-btn:hover { background: rgba(192,112,112,.22) !important; }
        [data-theme="dark"] .proj-delete-btn { background: transparent; }
        [data-theme="dark"] .proj-delete-btn:hover { background: rgba(192,112,112,.25) !important; }
      `}</style>
    </div>
  )
}
