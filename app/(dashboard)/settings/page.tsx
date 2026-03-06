export default function SettingsPage() {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gérez votre compte, votre plan et vos clés API.
        </p>
        <div className="mt-8 space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Plan actuel</h2>
            <p className="mt-1 text-sm text-gray-500">Free — 5 analyses et 20 clips par mois</p>
            <button className="mt-4 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors">
              Upgrader
            </button>
          </div>
        </div>
      </div>
    )
  }