-- ============================================
-- Quotas : messages IA mensuels + RPC increment_usage
-- ============================================
-- EXÉCUTION (projet déjà en prod / staging) :
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Coller tout ce fichier → Run
-- ============================================
-- Idempotent : ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE FUNCTION
-- ============================================

ALTER TABLE usage
  ADD COLUMN IF NOT EXISTS ai_messages_count INTEGER NOT NULL DEFAULT 0;

-- Ancienne signature (6 args) : à retirer sinon Postgres garde 2 surcharges
DROP FUNCTION IF EXISTS public.increment_usage(UUID, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC);

CREATE OR REPLACE FUNCTION increment_usage(
    p_user_id UUID,
    p_clips INTEGER DEFAULT 0,
    p_comparisons INTEGER DEFAULT 0,
    p_input_tokens INTEGER DEFAULT 0,
    p_output_tokens INTEGER DEFAULT 0,
    p_api_cost NUMERIC DEFAULT 0,
    p_ai_messages INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
    -- SECURITY DEFINER : forcer l’identité (évite qu’un user incrémente le quota d’un autre)
    IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'increment_usage: user mismatch' USING ERRCODE = '42501';
    END IF;
    -- Pas de décrément via paramètres négatifs
    IF p_clips < 0 OR p_comparisons < 0 OR p_ai_messages < 0
       OR p_input_tokens < 0 OR p_output_tokens < 0 OR p_api_cost < 0 THEN
        RAISE EXCEPTION 'increment_usage: negative increment not allowed' USING ERRCODE = '23514';
    END IF;

    INSERT INTO usage (
        user_id, year, month,
        clips_count, comparisons_count, ai_messages_count,
        total_input_tokens, total_output_tokens, total_api_cost_usd, updated_at
    )
    VALUES (
        p_user_id,
        EXTRACT(YEAR FROM NOW())::INTEGER,
        EXTRACT(MONTH FROM NOW())::INTEGER,
        p_clips,
        p_comparisons,
        p_ai_messages,
        p_input_tokens,
        p_output_tokens,
        p_api_cost,
        NOW()
    )
    ON CONFLICT (user_id, year, month) DO UPDATE SET
        clips_count         = usage.clips_count + EXCLUDED.clips_count,
        comparisons_count   = usage.comparisons_count + EXCLUDED.comparisons_count,
        ai_messages_count   = usage.ai_messages_count + EXCLUDED.ai_messages_count,
        total_input_tokens  = usage.total_input_tokens + EXCLUDED.total_input_tokens,
        total_output_tokens = usage.total_output_tokens + EXCLUDED.total_output_tokens,
        total_api_cost_usd  = usage.total_api_cost_usd + EXCLUDED.total_api_cost_usd,
        updated_at          = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Permet à supabase.rpc('increment_usage', …) depuis le client avec JWT user
GRANT EXECUTE ON FUNCTION increment_usage(UUID, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, INTEGER) TO authenticated, service_role;
