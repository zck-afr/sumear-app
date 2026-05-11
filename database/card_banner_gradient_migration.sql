-- Optional per-project banner gradient (CSS background value). When null, UI uses index-based cycle.
-- Run in Supabase SQL Editor if not already applied.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS card_banner_gradient TEXT;

COMMENT ON COLUMN public.projects.card_banner_gradient IS 'Optional CSS linear-gradient for project card banner; overrides list index when set';
