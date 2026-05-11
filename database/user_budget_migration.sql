-- Budget utilisateur cible pour le projet (synthèse IA et suivi)
-- Exécuter dans Supabase Dashboard → SQL Editor

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS user_budget NUMERIC;

COMMENT ON COLUMN public.projects.user_budget IS 'User-defined target budget (same currency as project products total)';
