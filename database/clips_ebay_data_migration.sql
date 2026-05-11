-- ============================================================================
-- Migration: eBay-specific clip data
-- Stores listing type, condition, seller info, seller feedback and auction
-- state for clips coming from eBay. NULL for every other source_domain.
-- Exécuter dans Supabase Dashboard → SQL Editor.
-- ============================================================================

ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS ebay_data JSONB;
ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS ebay_data_refreshed_at TIMESTAMPTZ;

-- Partial index: only rows where ebay_data is populated — keeps the index
-- tiny and accelerates analytics queries / retention jobs on eBay clips.
CREATE INDEX IF NOT EXISTS idx_clips_ebay_data
  ON public.clips ((ebay_data IS NOT NULL))
  WHERE ebay_data IS NOT NULL;

-- TTL cleanup: after 30 days we drop the `seller_feedback` array
-- (volatile third-party text, no long-term analytical value) while keeping
-- the rest of the eBay payload (listing_type, condition, seller, auction).
CREATE OR REPLACE FUNCTION public.cleanup_ebay_seller_feedback()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clips
  SET ebay_data =
    (ebay_data - 'seller_feedback')
    || jsonb_build_object('seller_feedback', '[]'::jsonb)
  WHERE ebay_data IS NOT NULL
    AND ebay_data_refreshed_at < NOW() - INTERVAL '30 days'
    AND ebay_data ? 'seller_feedback'
    AND jsonb_array_length(ebay_data -> 'seller_feedback') > 0;
END;
$$;

-- NOTE: Supabase does not offer a native cron. Wire up either pg_cron or a
-- scheduled edge function to run `SELECT public.cleanup_ebay_seller_feedback();`
-- once per day. This requirement must also be documented in ARCHITECTURE.md.

COMMENT ON COLUMN public.clips.ebay_data IS
  'eBay-specific payload (listing, seller, feedback). NULL for every other source_domain.';
COMMENT ON COLUMN public.clips.ebay_data_refreshed_at IS
  'Timestamp of the last eBay extraction. Used as TTL anchor for seller_feedback cleanup.';
