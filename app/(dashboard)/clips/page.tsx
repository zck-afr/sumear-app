export default function ProjectsPage() {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Projets</h1>
        <p className="mt-1 text-sm text-gray-500">
          Organisez vos recherches d&apos;achat par projet.
        </p>
        <div className="mt-8 text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900">Aucun projet</h3>
          <p className="mt-1 text-sm text-gray-500">Créez un projet pour organiser vos clips.</p>
        </div>
      </div>
    )
  }