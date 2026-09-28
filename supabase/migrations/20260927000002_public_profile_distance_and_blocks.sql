-- 20260927000002_public_profile_distance_and_blocks.sql
-- Adds (1) a fuzzed host↔requester distance RPC for the public profile view,
-- and (2) a real block list that is enforced across discovery and join requests.
--
-- Privacy: `get_fuzzed_distance` never returns a precise coordinate — it rounds
-- to the nearest 100 m, matching the discovery fuzzing (~100 m) convention.

-- ---------------------------------------------------------------------------
-- 1. Blocks table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT check_no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id ON public.blocks (blocked_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own blocks" ON public.blocks;
CREATE POLICY "Users manage their own blocks"
ON public.blocks FOR ALL TO authenticated
USING (auth.uid() = blocker_id)
WITH CHECK (auth.uid() = blocker_id);

GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Symmetric block check (SECURITY DEFINER so RLS never hides a block from
--    the caller-side guards below).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_blocked_between(p_a UUID, p_b UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = p_a AND blocked_id = p_b)
       OR (blocker_id = p_b AND blocked_id = p_a)
  );
$$;

REVOKE ALL ON FUNCTION public.is_blocked_between(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_blocked_between(UUID, UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Block / unblock RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_user(p_blocked_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_blocked_id = v_caller THEN RAISE EXCEPTION 'Cannot block yourself'; END IF;

  INSERT INTO public.blocks (blocker_id, blocked_id)
  VALUES (v_caller, p_blocked_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'blocked_id', p_blocked_id);
END; $$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_blocked_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  DELETE FROM public.blocks
  WHERE blocker_id = v_caller AND blocked_id = p_blocked_id;

  RETURN jsonb_build_object('success', true, 'blocked_id', p_blocked_id);
END; $$;

REVOKE ALL ON FUNCTION public.block_user(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unblock_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_user(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unblock_user(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Fuzzed distance between the caller and another user (~100 m rounding)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_fuzzed_distance(p_target_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_raw DOUBLE PRECISION;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_target_user_id = v_caller THEN
    RETURN jsonb_build_object('available', false);
  END IF;

  SELECT ST_Distance(c.last_location::geography, t.last_location::geography)
  INTO v_raw
  FROM public.profiles c
  JOIN public.profiles t ON t.id = p_target_user_id
  WHERE c.id = v_caller
    AND c.last_location IS NOT NULL
    AND t.last_location IS NOT NULL;

  IF v_raw IS NULL THEN
    RETURN jsonb_build_object('available', false);
  END IF;

  RETURN jsonb_build_object(
    'available', true,
    'distance_m', GREATEST(100, ROUND(v_raw / 100.0) * 100)::INTEGER
  );
END; $$;

REVOKE ALL ON FUNCTION public.get_fuzzed_distance(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_fuzzed_distance(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Enforce blocks in discovery (hide squads whose host is blocked either way)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_nearby_activities(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID, host_id UUID, interest_id TEXT, title TEXT, description TEXT,
  tier TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION, venue_name TEXT,
  filter_gender gender_filter, filter_age_min INTEGER, filter_age_max INTEGER,
  expires_at TIMESTAMPTZ, max_participants INTEGER, current_participants_count INTEGER,
  distance_meters DOUBLE PRECISION, created_at TIMESTAMPTZ,
  status activity_status, image_urls TEXT[]
) AS $$
DECLARE
  caller_id UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.host_id, a.interest_id, a.title, a.description, a.tier,
    ST_Y(a.fuzzed_location::geometry), ST_X(a.fuzzed_location::geometry),
    a.venue_name, a.filter_gender, a.filter_age_min, a.filter_age_max,
    a.expires_at, a.max_participants, a.current_participants_count,
    ST_Distance(a.fuzzed_location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography),
    a.created_at, a.status, a.image_urls
  FROM public.activities AS a
  WHERE a.status IN ('open', 'full', 'in_progress')
    AND a.expires_at > NOW()
    AND a.host_id IS DISTINCT FROM caller_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.activity_members AS m
      WHERE m.activity_id = a.id
        AND m.user_id = caller_id
    )
    -- Never surface a squad hosted by someone in a block relationship.
    AND NOT public.is_blocked_between(caller_id, a.host_id)
    AND ST_DWithin(
      a.fuzzed_location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_km * 1000
    )
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;

REVOKE ALL ON FUNCTION public.get_nearby_activities(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_nearby_activities(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Enforce blocks when requesting to join (blocked users cannot request)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_to_join_activity(p_activity_id UUID, p_user_id UUID, p_message TEXT DEFAULT '')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; a RECORD;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT id, host_id, status INTO a FROM public.activities WHERE id = p_activity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Activity not found: %', p_activity_id; END IF;
  IF a.status <> 'open' THEN RAISE EXCEPTION 'Activity is not open for joining'; END IF;
  IF a.host_id = p_user_id THEN RAISE EXCEPTION 'Host cannot request to join their own activity'; END IF;
  IF public.is_blocked_between(p_user_id, a.host_id) THEN
    RAISE EXCEPTION 'This squad is not available';
  END IF;
  INSERT INTO public.join_requests(activity_id, user_id, message, status)
    VALUES (p_activity_id, p_user_id, COALESCE(p_message, ''), 'pending'::join_request_status)
    ON CONFLICT (activity_id, user_id) DO UPDATE SET
      message = CASE WHEN EXCLUDED.message <> '' THEN EXCLUDED.message ELSE join_requests.message END,
      status = CASE WHEN join_requests.status = 'declined' THEN 'pending'::join_request_status ELSE join_requests.status END
    RETURNING id, activity_id, user_id, message, status, created_at INTO r;
  RETURN jsonb_build_object('id', r.id, 'activity_id', r.activity_id, 'user_id', r.user_id,
    'message', r.message, 'status', r.status, 'created_at', r.created_at);
END; $$;

GRANT EXECUTE ON FUNCTION public.request_to_join_activity(UUID, UUID, TEXT) TO authenticated, service_role;
