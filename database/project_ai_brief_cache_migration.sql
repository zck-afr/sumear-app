-- Cache du brief IA sur la fiche projet (évite 1 appel LLM + 1 quota à chaque chargement).
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS ai_brief TEXT,
  ADD COLUMN IF NOT EXISTS ai_brief_fingerprint TEXT;
