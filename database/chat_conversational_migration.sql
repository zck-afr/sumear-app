-- ============================================================
-- Migration : chat conversationnel
-- Ajoute session_type, project_id, web_search_enabled
-- sur chat_sessions. Idempotente — safe à relancer.
-- ============================================================

-- 1. Enum session_type
DO $$ BEGIN
  CREATE TYPE chat_session_type AS ENUM ('conversational', 'clip_based', 'project_brief');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Nouvelles colonnes

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS session_type chat_session_type NOT NULL DEFAULT 'clip_based';

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS web_search_enabled BOOLEAN NOT NULL DEFAULT true;

-- 3. Backfill : sessions existantes → clip_based (déjà le défaut, mais explicite)
UPDATE chat_sessions
  SET session_type = 'clip_based'
  WHERE session_type IS NULL;

-- 4. Index sidebar (chats récents par user)
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated
  ON chat_sessions (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_type
  ON chat_sessions (user_id, session_type);

-- 5. Commentaires
COMMENT ON COLUMN chat_sessions.session_type IS
  'conversational = chat libre avec web search | clip_based = chat sur produit clippé via popup | project_brief = brief IA d''un projet';

COMMENT ON COLUMN chat_sessions.project_id IS
  'NULL pour conversational et clip_based, FK vers projects pour project_brief';

COMMENT ON COLUMN chat_sessions.web_search_enabled IS
  'Active le tool web_search (Anthropic). Toujours false pour clip_based, toujours true pour conversational';

-- ============================================================
-- RLS — aucun changement nécessaire.
-- Les policies existantes sur chat_sessions, chat_session_clips
-- et chat_messages filtrent par user_id / session ownership :
-- elles couvrent nativement tous les session_type.
-- Vérifier dans Supabase Dashboard > Authentication > Policies
-- que "Users can manage own chat_sessions" est bien actif.
-- ============================================================
