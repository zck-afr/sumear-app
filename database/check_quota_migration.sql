-- Aligner check_quota sur lib/config/plans.ts (après quota_ai_messages_migration.sql).
-- L’app utilise checkQuota() en TypeScript ; cette RPC est optionnelle (dashboard / outils).

CREATE OR REPLACE FUNCTION check_quota(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_plan        plan_type;
    v_billing     TEXT;
    v_clips       INTEGER;
    v_projects    INTEGER;
    v_comparisons INTEGER;
    v_ai_messages INTEGER;
    v_year        INTEGER;
    v_month       INTEGER;
    c_free_clips           CONSTANT INTEGER := 8;
    c_free_projects        CONSTANT INTEGER := 2;
    c_free_comparisons_mo  CONSTANT INTEGER := 5;
    c_free_ai_messages_mo  CONSTANT INTEGER := 25;
    c_complete_ai_mo       CONSTANT INTEGER := 1000;
BEGIN
    IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'check_quota: user mismatch' USING ERRCODE = '42501';
    END IF;

    SELECT plan INTO v_plan FROM profiles WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'check_quota: profile not found' USING ERRCODE = '23503';
    END IF;

    v_billing := CASE WHEN v_plan = 'free' THEN 'free' ELSE 'complete' END;

    SELECT COUNT(*)::INTEGER INTO v_clips FROM public.clips WHERE user_id = p_user_id;
    SELECT COUNT(*)::INTEGER INTO v_projects FROM public.projects WHERE user_id = p_user_id;

    v_year  := EXTRACT(YEAR FROM NOW())::INTEGER;
    v_month := EXTRACT(MONTH FROM NOW())::INTEGER;

    SELECT COALESCE(comparisons_count, 0), COALESCE(ai_messages_count, 0)
    INTO v_comparisons, v_ai_messages
    FROM public.usage
    WHERE user_id = p_user_id AND year = v_year AND month = v_month;

    IF NOT FOUND THEN
        v_comparisons := 0;
        v_ai_messages := 0;
    END IF;

    RETURN jsonb_build_object(
        'plan_raw', v_plan,
        'billing', v_billing,
        'clips', jsonb_build_object(
            'count', v_clips,
            'limit', CASE WHEN v_billing = 'free' THEN c_free_clips ELSE -1 END,
            'is_allowed', CASE WHEN v_billing = 'free' THEN v_clips < c_free_clips ELSE true END
        ),
        'projects', jsonb_build_object(
            'count', v_projects,
            'limit', CASE WHEN v_billing = 'free' THEN c_free_projects ELSE -1 END,
            'is_allowed', CASE WHEN v_billing = 'free' THEN v_projects < c_free_projects ELSE true END
        ),
        'comparisons_month', jsonb_build_object(
            'count', v_comparisons,
            'limit', CASE WHEN v_billing = 'free' THEN c_free_comparisons_mo ELSE -1 END,
            'is_allowed', CASE WHEN v_billing = 'free' THEN v_comparisons < c_free_comparisons_mo ELSE true END
        ),
        'ai_messages_month', jsonb_build_object(
            'count', v_ai_messages,
            'limit', CASE WHEN v_billing = 'free' THEN c_free_ai_messages_mo ELSE c_complete_ai_mo END,
            'is_allowed', CASE WHEN v_billing = 'free' THEN v_ai_messages < c_free_ai_messages_mo ELSE v_ai_messages < c_complete_ai_mo END
        ),
        'comparisons_used', v_comparisons,
        'comparisons_limit', CASE WHEN v_billing = 'free' THEN c_free_comparisons_mo ELSE -1 END,
        'is_allowed_comparisons', CASE WHEN v_billing = 'free' THEN v_comparisons < c_free_comparisons_mo ELSE true END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION check_quota(UUID) TO authenticated, service_role;
