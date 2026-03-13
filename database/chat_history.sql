-- ============================================
-- Historique des discussions chat (produits)
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- Sessions de chat (une par conversation)
CREATE TABLE IF NOT EXISTS chat_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title       TEXT NOT NULL DEFAULT 'Discussion',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(user_id, updated_at DESC);

-- Produits liés à une session
CREATE TABLE IF NOT EXISTS chat_session_clips (
    session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    clip_id     UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, clip_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_session_clips_session ON chat_session_clips(session_id);

-- Messages d'une session
CREATE TABLE IF NOT EXISTS chat_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

-- RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_session_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chat_sessions"
    ON chat_sessions FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own chat_session_clips"
    ON chat_session_clips FOR ALL
    USING (
        session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage own chat_messages"
    ON chat_messages FOR ALL
    USING (
        session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid())
    );
