-- ============================================================================
-- Migration: security_logs table for prompt injection monitoring
-- Run once on each environment (Supabase SQL editor).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.security_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message     TEXT NOT NULL,
    triggers    TEXT[] NOT NULL DEFAULT '{}',
    ip          TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.security_logs IS 'Logs of suspicious user messages detected by prompt injection heuristics';

CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON public.security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON public.security_logs(created_at DESC);

ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write (admin route uses service_role via admin client)
-- Regular users have NO access to this table
CREATE POLICY "Service role full access"
    ON public.security_logs
    USING (false)
    WITH CHECK (false);
