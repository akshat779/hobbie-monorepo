-- Migration: 20260918000000_harden_feedback_uniqueness_and_profile_grants.sql
-- Description:
--   1. Enforce 3NF composite uniqueness on public.ratings so a reviewer can rate
--      a given target at most once per activity.
--   2. Recompute inflated trust_score / ratings_count / interaction_count values
--      that duplicate feedback submissions produced before the constraint existed.
--   3. Refactor submit_activity_feedback_tx to a deterministic
--      ON CONFLICT (activity_id, reviewer_id, target_user_id) DO UPDATE upsert.
--   4. Re-issue the column-level SELECT grant on public.profiles to include
--      ratings_count, which migration 20260915000001 added after the mask in
--      20260906071836 was written, leaving the column unreadable via the Data API.
--
-- Forward-only: the accepted-column list in 20260906071836 is intentionally NOT
-- edited in place, because that migration is already applied. The grant is
-- re-issued additively here.

-- ---------------------------------------------------------------------------
-- 1. Deduplicate pre-existing ratings deterministically (keep newest per triple)
-- ---------------------------------------------------------------------------
DELETE FROM public.ratings AS r
USING public.ratings AS dup
WHERE r.activity_id = dup.activity_id
  AND r.reviewer_id = dup.reviewer_id
  AND r.target_user_id = dup.target_user_id
  AND (
    r.created_at < dup.created_at
    OR (r.created_at = dup.created_at AND r.id < dup.id)
  );

-- ---------------------------------------------------------------------------
-- 2. Add the composite unique constraint (idempotent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unique_activity_reviewer_target'
      AND conrelid = 'public.ratings'::regclass
  ) THEN
    ALTER TABLE public.ratings
      ADD CONSTRAINT unique_activity_reviewer_target
      UNIQUE (activity_id, reviewer_id, target_user_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Repair trust aggregates that duplicate rows inflated
-- ---------------------------------------------------------------------------
UPDATE public.profiles AS p
SET
  trust_score = COALESCE(s.avg_score, 5.00),
  ratings_count = COALESCE(s.ratings_count, 0),
  interaction_count = GREATEST(p.interaction_count, COALESCE(s.ratings_count, 0))
FROM (
  SELECT
    target_user_id,
    ROUND(AVG(score)::numeric, 2) AS avg_score,
    COUNT(*) AS ratings_count
  FROM public.ratings
  GROUP BY target_user_id
) AS s
WHERE p.id = s.target_user_id;

-- ---------------------------------------------------------------------------
-- 4. Deterministic upsert feedback transaction
-- ---------------------------------------------------------------------------
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

  -- Upsert rating: re-submission overwrites instead of inserting a duplicate row.
  -- The unique constraint unique_activity_reviewer_target guarantees the conflict target.
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
  )
  ON CONFLICT (activity_id, reviewer_id, target_user_id)
  DO UPDATE SET
    score = EXCLUDED.score,
    tags = EXCLUDED.tags,
    keep_in_touch = EXCLUDED.keep_in_touch,
    created_at = NOW();

  -- Recompute target user's trust score and ratings count from the deduplicated set
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

-- ---------------------------------------------------------------------------
-- 5. Restore Data API readability of ratings_count on public.profiles
-- ---------------------------------------------------------------------------
GRANT SELECT (
  id,
  name,
  birth_date,
  gender,
  interests,
  is_verified,
  trust_score,
  interaction_count,
  avatar_url,
  created_at,
  updated_at,
  ratings_count
) ON public.profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Set function permissions
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.submit_activity_feedback_tx(UUID, UUID, UUID, INTEGER, TEXT[], BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_activity_feedback_tx(UUID, UUID, UUID, INTEGER, TEXT[], BOOLEAN) TO authenticated, service_role;