import { createHash } from 'crypto'
import type { Clip } from '@/components/chat/chat-content'

/**
 * Empreinte de la « liste produits » pour le cache du brief IA.
 * Tant qu’elle est identique, on réutilise ai_brief sans appel LLM.
 * Invalide si ajout/suppression de clip ou changement nom / marque / prix / devise.
 */
export function projectProductsBriefFingerprint(products: Clip[]): string {
  const rows = [...products]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(p => {
      const price =
        p.price != null && !Number.isNaN(p.price) ? String(p.price) : ''
      return [
        p.id,
        (p.product_name || '').trim(),
        (p.brand || '').trim(),
        price,
        (p.currency || 'EUR').trim(),
      ].join('\x1f')
    })
  return createHash('sha256').update(rows.join('\n'), 'utf8').digest('hex')
}
