// ============================================================================
// Sumear App — eBay-specific types
// ============================================================================
// Must be kept in sync with sumear-extension/src/content/types-ebay.ts.
// These fields are persisted on clips.ebay_data (JSONB) only when the clip
// comes from an eBay listing — NULL for any other source_domain.
// ============================================================================

export type EbayListingType = 'buy_it_now' | 'auction' | 'both';

/**
 * Detailed seller ratings (0–5 scale) exposed on the PDP under
 * `.fdbk-seller-rating__detailed-list`. Unknown rating labels are dropped.
 */
export interface EbayDetailedRatings {
  accurate_description: number | null;
  reasonable_shipping_cost: number | null;
  shipping_speed: number | null;
  communication: number | null;
}

export interface EbaySellerData {
  name: string;
  /** Total feedback score shown next to the seller name, e.g. "(705)" → 705. */
  feedback_score: number | null;
  /** Percentage of positive feedback, e.g. "100% positive feedback" → 100. */
  positive_feedback_percent: number | null;
  /** Count visible in the feedback panel title: "Seller feedback (96)" → 96. */
  feedback_count: number | null;
  /** "112 items sold" → 112 (from .x-store-information__highlights). */
  items_sold: number | null;
  /** Free-text join date, e.g. "Joined Mar 2001" (calendar icon row). */
  member_since: string | null;
  /** Free-text, e.g. "Usually responds within 24 hours" (clock icon row). */
  response_time: string | null;
  detailed_ratings: EbayDetailedRatings | null;
}

export interface EbaySellerFeedback {
  /**
   * Defaults to 'positive' because the PDP only shows positive feedback in
   * the default tab. The user could switch to neutral/negative filters but
   * we never change tabs — we only read what the page renders.
   */
  rating: 'positive' | 'neutral' | 'negative';
  /** eBay username, already anonymised by eBay: "a***a (1351)". */
  username: string | null;
  /** Human-readable age bucket: "Past 6 months", "Past month", "Past year". */
  date: string | null;
  /** True when `.fdbk-container__details__verified__purchase` is present. */
  verified_purchase: boolean;
  /** Free-text buyer comment, clamped to 500 chars. */
  comment: string;
  /** Name of the item the buyer left feedback on. */
  item_name: string | null;
}

export interface EbayAuctionData {
  current_bid: number;
  bid_count: number;
  time_left: string;
  reserve_met: boolean | null;
}

export interface EbayData {
  listing_type: EbayListingType;
  condition: string | null;
  seller_description: string | null;
  seller: EbaySellerData | null;
  seller_feedback: EbaySellerFeedback[];
  auction_data: EbayAuctionData | null;
}
