-- ============================================
-- Migration: add clips.updated_at
-- ============================================
-- Context: dedup feature for /api/clips POST.
-- When a user re-clips the same (normalized) URL within the same project,
-- the API performs an UPDATE instead of an INSERT and refreshes updated_at.
-- ============================================

-- 1. Add the column nullable (so we can backfill before enforcing NOT NULL).
ALTER TABLE clips
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 2. Backfill historical rows: set updated_at = created_at for any row left
--    without a value. Idempotent — safe to re-run.
UPDATE clips
SET    updated_at = created_at
WHERE  updated_at IS NULL;

-- 3. Enforce NOT NULL and default for new inserts.
ALTER TABLE clips
    ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE clips
    ALTER COLUMN updated_at SET DEFAULT NOW();
