-- ============================================
-- BriefAI — Schema MVP
-- Compatible Supabase (PostgreSQL 15+)
-- ============================================
-- À exécuter dans l'éditeur SQL de Supabase
-- Dashboard → SQL Editor → New Query
-- ============================================


-- ============================================
-- 1. TYPES ENUM
-- ============================================

CREATE TYPE plan_type AS ENUM ('free', 'pro', 'complete');
CREATE TYPE provider_type AS ENUM ('openai', 'anthropic');
CREATE TYPE extraction_method AS ENUM ('jsonld', 'markdown', 'hybrid');
CREATE TYPE comparison_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE key_source_type AS ENUM ('managed', 'byok');


-- ============================================
-- 2. TABLE PROFILES
-- Extension de auth.users (géré par Supabase Auth)
-- ============================================

CREATE TABLE profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    full_name   TEXT,
    avatar_url  TEXT,
    plan        plan_type NOT NULL DEFAULT 'free',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-créer un profil quand un user s'inscrit
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================
-- 3. TABLE API_KEYS (BYOK)
-- Stocke les clés API chiffrées des utilisateurs
-- ============================================

CREATE TABLE api_keys (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider          provider_type NOT NULL,
    encrypted_key     TEXT NOT NULL,           -- chiffré AES-256 côté serveur
    key_hint          TEXT,                    -- "sk-...7xQ2" pour affichage
    is_valid          BOOLEAN NOT NULL DEFAULT TRUE,
    last_validated_at TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un seul provider par utilisateur (il peut changer sa clé, pas en avoir 2 du même)
    UNIQUE(user_id, provider)
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);


-- ============================================
-- 4. TABLE PROJECTS (dossiers d'achat)
-- ============================================

CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    emoji       TEXT DEFAULT '📦',
    position    INTEGER NOT NULL DEFAULT 0,   -- pour le tri drag & drop
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_user ON projects(user_id);


-- ============================================
-- 5. TABLE CLIPS (produits extraits)
-- Cœur du système — chaque "clip" = un produit capturé
-- ============================================

CREATE TABLE clips (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,  -- nullable = clip non classé

    -- Identité produit
    source_url        TEXT NOT NULL,
    source_domain     TEXT NOT NULL,            -- extrait de l'URL (amazon.fr, fnac.com)
    product_name      TEXT NOT NULL,
    brand             TEXT,
    image_url         TEXT,

    -- Prix & avis
    price             NUMERIC(10,2),
    currency          TEXT DEFAULT 'EUR',
    rating            NUMERIC(3,2),             -- ex: 4.85 (supporte 0.00 à 5.00+)
    review_count      INTEGER,

    -- Données brutes d'extraction
    raw_jsonld        JSONB,                    -- Schema.org/Product complet
    raw_markdown      TEXT,                     -- fallback Turndown.js
    extraction_method extraction_method NOT NULL DEFAULT 'jsonld',

    -- Données traitées (pré-processing côté extension)
    extracted_specs   JSONB DEFAULT '{}',       -- specs normalisées {clé: valeur}
    extracted_reviews JSONB DEFAULT '[]',       -- top 20 avis [{text, rating, date, helpful_count}]

    clipped_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- quand le user a clippé
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clips_user ON clips(user_id);
CREATE INDEX idx_clips_project ON clips(project_id);
CREATE INDEX idx_clips_domain ON clips(source_domain);
-- Détection de doublons : même user + même URL = alerte dans le frontend
CREATE INDEX idx_clips_user_url ON clips(user_id, source_url);


-- ============================================
-- 6. TABLE COMPARISONS (analyses IA)
-- ============================================

CREATE TABLE comparisons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,

    title           TEXT,                       -- auto-généré ("Aspirateurs robots") ou custom
    status          comparison_status NOT NULL DEFAULT 'pending',

    -- Résultats IA
    result_matrix   JSONB,                     -- matrice structurée de comparaison
    result_analysis JSONB,                     -- {strengths, red_flags, verdict, confidence}

    -- Traçabilité & coûts
    model_used      TEXT,                      -- 'claude-sonnet-4.5', 'gpt-4o', etc.
    input_tokens    INTEGER DEFAULT 0,
    output_tokens   INTEGER DEFAULT 0,
    api_cost_usd    NUMERIC(8,6) DEFAULT 0,    -- ex: 0.082300
    key_source      key_source_type NOT NULL DEFAULT 'managed',

    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comparisons_user ON comparisons(user_id);
CREATE INDEX idx_comparisons_project ON comparisons(project_id);
CREATE INDEX idx_comparisons_status ON comparisons(status);


-- ============================================
-- 7. TABLE COMPARISON_CLIPS (liaison N:N)
-- Quels clips font partie de quelle comparaison
-- ============================================

CREATE TABLE comparison_clips (
    comparison_id UUID NOT NULL REFERENCES comparisons(id) ON DELETE CASCADE,
    clip_id       UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
    position      INTEGER NOT NULL DEFAULT 0,  -- ordre dans la matrice

    PRIMARY KEY (comparison_id, clip_id)
);

CREATE INDEX idx_cc_clip ON comparison_clips(clip_id);


-- ============================================
-- 8. TABLE USAGE (compteurs mensuels)
-- Pour gérer le freemium et les crédits
-- ============================================

CREATE TABLE usage (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    year                 INTEGER NOT NULL CHECK (year >= 2024 AND year <= 2100),
    month                INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),

    clips_count          INTEGER NOT NULL DEFAULT 0,
    comparisons_count    INTEGER NOT NULL DEFAULT 0,
    total_input_tokens   INTEGER NOT NULL DEFAULT 0,
    total_output_tokens  INTEGER NOT NULL DEFAULT 0,
    total_api_cost_usd   NUMERIC(10,6) NOT NULL DEFAULT 0,

    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un seul enregistrement par user par mois
    UNIQUE(user_id, year, month)
);

CREATE INDEX idx_usage_user_period ON usage(user_id, year, month);


-- ============================================
-- 9. ROW LEVEL SECURITY (RLS)
-- Chaque user ne voit que SES données
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;

-- Profiles : lecture/écriture de son propre profil uniquement
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Note : INSERT sur profiles géré par le trigger handle_new_user() en SECURITY DEFINER.
-- On ajoute quand même une policy INSERT restrictive par sécurité.
CREATE POLICY "System can insert profiles"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- API Keys : CRUD sur ses propres clés uniquement
CREATE POLICY "Users can manage own api keys"
    ON api_keys FOR ALL
    USING (auth.uid() = user_id);

-- Projects : CRUD sur ses propres projets
CREATE POLICY "Users can manage own projects"
    ON projects FOR ALL
    USING (auth.uid() = user_id);

-- Clips : CRUD sur ses propres clips
CREATE POLICY "Users can manage own clips"
    ON clips FOR ALL
    USING (auth.uid() = user_id);

-- Comparisons : CRUD sur ses propres comparaisons
CREATE POLICY "Users can manage own comparisons"
    ON comparisons FOR ALL
    USING (auth.uid() = user_id);

-- Comparison_clips : accès via la comparaison parente
CREATE POLICY "Users can manage own comparison clips"
    ON comparison_clips FOR ALL
    USING (
        comparison_id IN (
            SELECT id FROM comparisons WHERE user_id = auth.uid()
        )
    );

-- Usage : lecture seule (écriture via increment_usage() en SECURITY DEFINER)
CREATE POLICY "Users can view own usage"
    ON usage FOR SELECT
    USING (auth.uid() = user_id);


-- ============================================
-- 10. FONCTIONS UTILITAIRES
-- ============================================

-- Fonction pour incrémenter l'usage (appelée par ton backend)
CREATE OR REPLACE FUNCTION increment_usage(
    p_user_id UUID,
    p_clips INTEGER DEFAULT 0,
    p_comparisons INTEGER DEFAULT 0,
    p_input_tokens INTEGER DEFAULT 0,
    p_output_tokens INTEGER DEFAULT 0,
    p_api_cost NUMERIC DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO usage (user_id, year, month, clips_count, comparisons_count, total_input_tokens, total_output_tokens, total_api_cost_usd, updated_at)
    VALUES (
        p_user_id,
        EXTRACT(YEAR FROM NOW()),
        EXTRACT(MONTH FROM NOW()),
        p_clips,
        p_comparisons,
        p_input_tokens,
        p_output_tokens,
        p_api_cost,
        NOW()
    )
    ON CONFLICT (user_id, year, month) DO UPDATE SET
        clips_count         = usage.clips_count + EXCLUDED.clips_count,
        comparisons_count   = usage.comparisons_count + EXCLUDED.comparisons_count,
        total_input_tokens  = usage.total_input_tokens + EXCLUDED.total_input_tokens,
        total_output_tokens = usage.total_output_tokens + EXCLUDED.total_output_tokens,
        total_api_cost_usd  = usage.total_api_cost_usd + EXCLUDED.total_api_cost_usd,
        updated_at          = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Fonction pour vérifier si l'utilisateur a dépassé son quota
CREATE OR REPLACE FUNCTION check_quota(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_plan plan_type;
    v_comparisons INTEGER;
    v_limit INTEGER;
BEGIN
    -- Récupérer le plan
    SELECT plan INTO v_plan FROM profiles WHERE id = p_user_id;

    -- Récupérer l'usage du mois en cours (0 si pas encore de ligne)
    SELECT COALESCE(SUM(comparisons_count), 0) INTO v_comparisons
    FROM usage
    WHERE user_id = p_user_id
      AND year = EXTRACT(YEAR FROM NOW())
      AND month = EXTRACT(MONTH FROM NOW());

    -- Définir les limites par plan
    v_limit := CASE v_plan
        WHEN 'free' THEN 5          -- 5 analyses/mois (tier gratuit)
        WHEN 'pro' THEN 999999      -- illimité (BYOK, c'est la clé du user qui paie)
        WHEN 'complete' THEN 40     -- 40 analyses/mois
    END;

    RETURN jsonb_build_object(
        'plan', v_plan,
        'comparisons_used', v_comparisons,
        'comparisons_limit', v_limit,
        'remaining', v_limit - v_comparisons,
        'is_allowed', v_comparisons < v_limit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 11. TRIGGERS updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
