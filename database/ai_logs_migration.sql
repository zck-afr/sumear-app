-- ============================================================================
-- Migration: ai_logs table for per-call LLM token logging
-- Run once on each environment (Supabase SQL editor).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_logs (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id                  UUID REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
    type                        TEXT NOT NULL CHECK (type IN ('chat', 'brief')),
    model                       TEXT NOT NULL,
    input_tokens                INTEGER NOT NULL DEFAULT 0,
    output_tokens               INTEGER NOT NULL DEFAULT 0,
    cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_input_tokens     INTEGER NOT NULL DEFAULT 0,
    cost_usd                    NUMERIC(10,6) NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.ai_logs IS 'Per-call LLM usage log for cost monitoring and analytics';

CREATE INDEX IF NOT EXISTS idx_ai_logs_user_id ON public.ai_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON public.ai_logs(created_at);

-- RLS: users can only read their own logs; inserts allowed for own rows
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai_logs"
    ON public.ai_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai_logs"
    ON public.ai_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- No UPDATE/DELETE policies: logs are append-only
