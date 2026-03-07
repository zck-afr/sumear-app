import { createClient } from '@/lib/supabase/server'

export default async function ClipsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: clips, error } = await supabase
    .from('clips')
    .select('id, product_name, brand, source_domain, source_url, image_url, price, currency, rating, review_count, extraction_method, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Clips</h1>
      <p className="mt-1 text-sm text-gray-500">
        Tous vos produits capturés avec l&apos;extension Chrome.
      </p>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          Erreur lors du chargement des clips.
        </div>
      )}

      {(!clips || clips.length === 0) ? (
        <div className="mt-8 text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900">Aucun clip</h3>
          <p className="mt-1 text-sm text-gray-500">Utilisez l&apos;extension pour clipper des produits.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clips.map((clip) => (
            <ClipCard key={clip.id} clip={clip} />
          ))}
        </div>
      )}
    </div>
  )
}

interface Clip {
  id: string
  product_name: string
  brand: string | null
  source_domain: string
  source_url: string
  image_url: string | null
  price: number | null
  currency: string
  rating: number | null
  review_count: number | null
  extraction_method: string
  created_at: string
}

function ClipCard({ clip }: { clip: Clip }) {
  const formattedPrice = clip.price != null
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: clip.currency || 'EUR' }).format(clip.price)
    : null

  const formattedDate = new Date(clip.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })

  const stars = clip.rating != null
    ? '★'.repeat(Math.round(clip.rating)) + '☆'.repeat(5 - Math.round(clip.rating))
    : null

  return (
    <a
      href={clip.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Image */}
      <div className="h-40 bg-gray-50 flex items-center justify-center">
        {clip.image_url ? (
          <img
            src={clip.image_url}
            alt={clip.product_name}
            className="h-full w-full object-contain p-3"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="text-gray-300 text-4xl">📦</div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">
          {clip.product_name}
        </p>

        {clip.brand && (
          <p className="mt-1 text-xs text-gray-500">{clip.brand}</p>
        )}

        <div className="mt-2 flex items-center justify-between">
          {formattedPrice && (
            <span className="text-base font-bold text-emerald-600">{formattedPrice}</span>
          )}
          {stars && (
            <span className="text-xs text-amber-500" title={`${clip.rating}/5 (${clip.review_count ?? 0} avis)`}>
              {stars} {clip.rating}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
          <span>{clip.source_domain}</span>
          <span>{formattedDate}</span>
        </div>
      </div>
    </a>
  )
}
