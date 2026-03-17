import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, description, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projets</h1>
          <p className="mt-1 text-sm text-[#888]">Organisez vos comparaisons par projet.</p>
        </div>
      </div>

      {(!projects || projects.length === 0) ? (
        <div className="mt-8 text-center py-16 border border-dashed border-[#393E46] rounded-xl">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#393E46] flex items-center justify-center text-2xl mb-4">📁</div>
          <h3 className="text-sm font-semibold text-white">Aucun projet</h3>
          <p className="mt-1 text-sm text-[#555]">Les projets vous permettent de regrouper vos comparaisons.</p>
          <p className="mt-1 text-xs text-[#444]">Fonctionnalité à venir.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {projects.map(project => (
            <div key={project.id} className="rounded-xl bg-[#393E46] border border-[#393E46] p-5 hover:border-[#4a5059] transition-colors">
              <h3 className="text-sm font-semibold text-white">{project.name}</h3>
              {project.description && <p className="mt-1 text-xs text-[#888]">{project.description}</p>}
              <p className="mt-3 text-[10px] text-[#555]">
                Créé le {new Date(project.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
