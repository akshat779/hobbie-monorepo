-- Migration: Add ratings_count to profiles and update submit_activity_feedback_tx
-- Forward-only patch following strict migration guidelines

-- 1. Add ratings_count column to public.profiles if not present
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ratings_count INTEGER NOT NULL DEFAULT 0;

-- 2. Update submit_activity_feedback_tx procedure
CREATE OR REPLACE FUNCTION public.submit_activity_feedback_tx(
  p_activity_id UUID,
  p_reviewer_id UUID,
  p_target_user_id UUID,
  p_score INTEGER,
  p_tags TEXT[] DEFAULT '{}',
  p_keep_in_touch BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity RECORD;
  v_peer_opted_in BOOLEAN := FALSE;
  v_is_mutual BOOLEAN := FALSE;
  v_user_a UUID;
  v_user_b UUID;
  v_new_avg NUMERIC(3,2);
  v_ratings_count INTEGER;
BEGIN
  -- Verify caller authorization if authenticated via Supabase Auth
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_reviewer_id THEN
    RAISE EXCEPTION 'Unauthorized: Caller identity does not match reviewer';
  END IF;

  IF p_reviewer_id = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot submit feedback for yourself';
  END IF;

  IF p_score < 1 OR p_score > 5 THEN
    RAISE EXCEPTION 'Invalid rating score: % (must be 1 to 5)', p_score;
  END IF;

  -- Verify activity exists
  SELECT id, interest_id, status
  INTO v_activity
  FROM public.activities
  WHERE id = p_activity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity not found: %', p_activity_id;
  END IF;

  -- Verify reviewer was a member of this activity
  IF NOT EXISTS (
    SELECT 1 FROM public.activity_members
    WHERE activity_id = p_activity_id AND user_id = p_reviewer_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.activities
    WHERE id = p_activity_id AND host_id = p_reviewer_id
  ) THEN
    RAISE EXCEPTION 'Reviewer was not a member of activity %', p_activity_id;
  END IF;

  -- Insert rating (or update if already submitted)
  INSERT INTO public.ratings (
    activity_id,
    reviewer_id,
    target_user_id,
    score,
    tags,
    keep_in_touch
  ) VALUES (
    p_activity_id,
    p_reviewer_id,
    p_target_user_id,
    p_score,
    COALESCE(p_tags, '{}'),
    p_keep_in_touch
  );

  -- Update target user's trust score and ratings counts
  SELECT
    ROUND(AVG(score)::numeric, 2),
    COUNT(*)
  INTO
    v_new_avg,
    v_ratings_count
  FROM public.ratings
  WHERE target_user_id = p_target_user_id;

  UPDATE public.profiles
  SET
    trust_score = COALESCE(v_new_avg, 5.00),
    ratings_count = v_ratings_count,
    interaction_count = GREATEST(interaction_count, v_ratings_count)
  WHERE id = p_target_user_id;

  -- Evaluate Dual-Opt-In "Keep in Touch"
  IF p_keep_in_touch THEN
    SELECT keep_in_touch INTO v_peer_opted_in
    FROM public.ratings
    WHERE activity_id = p_activity_id
      AND reviewer_id = p_target_user_id
      AND target_user_id = p_reviewer_id;

    IF v_peer_opted_in IS TRUE THEN
      v_is_mutual := TRUE;
      v_user_a := LEAST(p_reviewer_id, p_target_user_id);
      v_user_b := GREATEST(p_reviewer_id, p_target_user_id);

      INSERT INTO public.kept_connections (
        user_a,
        user_b,
        interest_id
      ) VALUES (
        v_user_a,
        v_user_b,
        v_activity.interest_id
      )
      ON CONFLICT (user_a, user_b, interest_id) DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'activity_id', p_activity_id,
    'reviewer_id', p_reviewer_id,
    'target_user_id', p_target_user_id,
    'score', p_score,
    'mutual_connection', v_is_mutual
  );
END;
$$;

-- 3. Set Permissions
REVOKE EXECUTE ON FUNCTION public.submit_activity_feedback_tx(UUID, UUID, UUID, INTEGER, TEXT[], BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_activity_feedback_tx(UUID, UUID, UUID, INTEGER, TEXT[], BOOLEAN) TO authenticated, service_role;
