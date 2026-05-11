// ============================================================================
// Sumear App — eBay context formatter for LLM prompts
// ============================================================================
// Converts a persisted ebay_data JSONB payload into a plain-text block that
// the LLM can read as part of the product context. All text is piped through
// sanitizeProductData() to neutralise prompt-injection attempts hidden in
// seller descriptions or feedback comments.
// ============================================================================

import type { EbayData } from '@/lib/types/ebay'
import { sanitizeProductData } from '@/lib/utils/sanitize'

export function isEbaySource(sourceDomain: string | null | undefined): boolean {
  if (!sourceDomain) return false
  return /(?:^|\.)ebay\.[a-z.]+$/i.test(sourceDomain.toLowerCase())
}

/**
 * Normalise a value coming from JSONB (which can be a plain JS object, a
 * stringified JSON, or null). Returns null when we can't trust the shape.
 */
export function coerceEbayData(raw: unknown): EbayData | null {
  if (!raw) return null
  let obj: unknown = raw
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw) } catch { return null }
  }
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  if (typeof o.listing_type !== 'string') return null
  return o as EbayData
}

function fmt(v: string | number | null | undefined): string {
  if (v == null || v === '') return 'unknown'
  return sanitizeProductData(String(v))
}

/**
 * Build a concise eBay-specific section to append after the standard product
 * fields. Returns an empty string if the payload is null / invalid.
 */
export function formatEbayContext(
  ebay: EbayData | null,
  sourceDomain?: string | null
): string {
  if (!ebay) return ''
  if (sourceDomain != null && !isEbaySource(sourceDomain)) return ''

  const lines: string[] = []
  lines.push('eBay Listing Details:')
  lines.push(`- Listing type: ${fmt(ebay.listing_type)}`)
  if (ebay.condition) lines.push(`- Condition: ${fmt(ebay.condition)}`)

  if ((ebay.listing_type === 'auction' || ebay.listing_type === 'both') && ebay.auction_data) {
    const a = ebay.auction_data
    lines.push(
      `- Current bid: ${fmt(a.current_bid)}, Bids: ${fmt(a.bid_count)}, Time left: ${fmt(a.time_left)}`
    )
    if (a.reserve_met != null) {
      lines.push(`- Reserve: ${a.reserve_met ? 'met' : 'not met'}`)
    }
  }

  if (ebay.seller_description) {
    lines.push('')
    lines.push('Seller Description:')
    lines.push(fmt(ebay.seller_description))
  }

  if (ebay.seller) {
    const s = ebay.seller
    lines.push('')
    lines.push('Seller:')
    lines.push(`- Name: ${fmt(s.name)}`)
    if (s.feedback_score != null) lines.push(`- Feedback score: ${fmt(s.feedback_score)}`)
    if (s.positive_feedback_percent != null) {
      lines.push(`- Positive feedback: ${fmt(s.positive_feedback_percent)}%`)
    }
    if (s.feedback_count != null) lines.push(`- Feedback count: ${fmt(s.feedback_count)}`)
    if (s.items_sold != null) lines.push(`- Items sold: ${fmt(s.items_sold)}`)
    if (s.member_since) lines.push(`- Member since: ${fmt(s.member_since)}`)
    if (s.response_time) lines.push(`- Response time: ${fmt(s.response_time)}`)
    if (s.detailed_ratings) {
      const dr = s.detailed_ratings
      const parts: string[] = []
      if (dr.accurate_description != null) parts.push(`accurate description ${fmt(dr.accurate_description)}/5`)
      if (dr.reasonable_shipping_cost != null) parts.push(`reasonable shipping cost ${fmt(dr.reasonable_shipping_cost)}/5`)
      if (dr.shipping_speed != null) parts.push(`shipping speed ${fmt(dr.shipping_speed)}/5`)
      if (dr.communication != null) parts.push(`communication ${fmt(dr.communication)}/5`)
      if (parts.length) lines.push(`- Detailed ratings: ${parts.join(', ')}`)
    }
  }

  if (ebay.seller_feedback?.length) {
    lines.push('')
    lines.push('Recent seller feedback (latest reviews):')
    for (const f of ebay.seller_feedback) {
      const parts = [`[${f.rating}]`]
      if (f.verified_purchase) parts.push('(verified purchase)')
      parts.push(fmt(f.comment))
      if (f.username) parts.push(`— ${fmt(f.username)}`)
      if (f.date) parts.push(`(${fmt(f.date)})`)
      if (f.item_name) parts.push(`on "${fmt(f.item_name)}"`)
      lines.push(`- ${parts.join(' ')}`)
    }
  }

  return lines.join('\n')
}

export const EBAY_SYSTEM_PROMPT_ADDENDUM =
  "For eBay listings, consider BOTH the product and the seller's reputation. Highlight concerns if the seller has low feedback, new account, or slow response time. For auctions, advise on whether the current price is a good deal, NOT on bidding strategy."
