// ============================================================================
// Sumear App — eBay payload validator
// ============================================================================
// Runs on the API boundary (POST /api/clips). The input is untrusted JSON
// coming from the browser extension. We return a cleaned, clamped EbayData
// object or null — never throw, never trust.
// ============================================================================

import type {
  EbayData,
  EbayListingType,
  EbaySellerData,
  EbaySellerFeedback,
  EbayAuctionData,
  EbayDetailedRatings,
} from '@/lib/types/ebay'

const MAX_CONDITION = 100
const MAX_DESCRIPTION = 3000
const MAX_SELLER_NAME = 100
const MAX_SELLER_TEXT = 100
const MAX_FEEDBACK_COMMENT = 500
const MAX_FEEDBACK_USERNAME = 100
const MAX_FEEDBACK_DATE = 40
const MAX_FEEDBACK_ITEM_NAME = 200
const MAX_FEEDBACK_ITEMS = 8
const MAX_TIME_LEFT = 100

const LISTING_TYPES: readonly EbayListingType[] = ['buy_it_now', 'auction', 'both']
const FEEDBACK_RATINGS: readonly EbaySellerFeedback['rating'][] = ['positive', 'neutral', 'negative']

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  if (!trimmed) return null
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

function numOrNull(v: unknown, opts?: { min?: number; max?: number }): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  if (opts?.min != null && n < opts.min) return null
  if (opts?.max != null && n > opts.max) return null
  return n
}

function validateDetailedRatings(v: unknown): EbayDetailedRatings | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  const clamp01to5 = (x: unknown) => numOrNull(x, { min: 0, max: 5 })
  const out: EbayDetailedRatings = {
    accurate_description: clamp01to5(r.accurate_description),
    reasonable_shipping_cost: clamp01to5(r.reasonable_shipping_cost),
    shipping_speed: clamp01to5(r.shipping_speed),
    communication: clamp01to5(r.communication),
  }
  const any =
    out.accurate_description != null ||
    out.reasonable_shipping_cost != null ||
    out.shipping_speed != null ||
    out.communication != null
  return any ? out : null
}

function validateSeller(v: unknown): EbaySellerData | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  const name = clampStr(s.name, MAX_SELLER_NAME)
  if (!name) return null
  return {
    name,
    feedback_score: numOrNull(s.feedback_score, { min: 0, max: 1e9 }),
    positive_feedback_percent: numOrNull(s.positive_feedback_percent, { min: 0, max: 100 }),
    feedback_count: numOrNull(s.feedback_count, { min: 0, max: 1e9 }),
    items_sold: numOrNull(s.items_sold, { min: 0, max: 1e9 }),
    member_since: clampStr(s.member_since, MAX_SELLER_TEXT),
    response_time: clampStr(s.response_time, MAX_SELLER_TEXT),
    detailed_ratings: validateDetailedRatings(s.detailed_ratings),
  }
}

function validateFeedback(v: unknown): EbaySellerFeedback[] {
  if (!Array.isArray(v)) return []
  const out: EbaySellerFeedback[] = []
  for (const raw of v) {
    if (out.length >= MAX_FEEDBACK_ITEMS) break
    if (!raw || typeof raw !== 'object') continue
    const f = raw as Record<string, unknown>
    const rating = typeof f.rating === 'string' && (FEEDBACK_RATINGS as readonly string[]).includes(f.rating)
      ? (f.rating as EbaySellerFeedback['rating'])
      : 'positive' // default per extractor convention (PDP shows positives)
    const comment = clampStr(f.comment, MAX_FEEDBACK_COMMENT)
    if (!comment) continue
    out.push({
      rating,
      username: clampStr(f.username, MAX_FEEDBACK_USERNAME),
      date: clampStr(f.date, MAX_FEEDBACK_DATE),
      verified_purchase: f.verified_purchase === true,
      comment,
      item_name: clampStr(f.item_name, MAX_FEEDBACK_ITEM_NAME),
    })
  }
  return out
}

function validateAuction(v: unknown): EbayAuctionData | null {
  if (!v || typeof v !== 'object') return null
  const a = v as Record<string, unknown>
  const current_bid = numOrNull(a.current_bid, { min: 0, max: 1e9 })
  const bid_count = numOrNull(a.bid_count, { min: 0, max: 1e6 })
  const time_left = clampStr(a.time_left, MAX_TIME_LEFT) ?? ''
  const reserve_met = typeof a.reserve_met === 'boolean' ? a.reserve_met : null
  if (current_bid == null && bid_count == null && !time_left && reserve_met == null) return null
  return {
    current_bid: current_bid ?? 0,
    bid_count: bid_count ?? 0,
    time_left,
    reserve_met,
  }
}

/**
 * Validate and clean an eBay payload coming from the extension.
 * Returns a sanitized object on partial success (at least listing_type is a
 * valid enum), otherwise null. Never throws.
 */
export function validateEbayData(data: unknown): EbayData | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>

  const listing_type =
    typeof d.listing_type === 'string' && (LISTING_TYPES as readonly string[]).includes(d.listing_type)
      ? (d.listing_type as EbayListingType)
      : null

  if (!listing_type) return null

  return {
    listing_type,
    condition: clampStr(d.condition, MAX_CONDITION),
    seller_description: clampStr(d.seller_description, MAX_DESCRIPTION),
    seller: validateSeller(d.seller),
    seller_feedback: validateFeedback(d.seller_feedback),
    auction_data: validateAuction(d.auction_data),
  }
}
