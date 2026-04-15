a-- ============================================
-- Brief IA : ajout de brief_generated_at pour le debounce (30s)
-- ============================================
-- Exécuter dans Supabase Dashboard → SQL Editor

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS brief_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.projects.brief_generated_at IS 'Timestamp of last AI brief generation — used for 30s debounce';
