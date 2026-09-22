-- Migration: Enrich discovery + roster RPCs to match the shared Zod domain contracts.
--
-- Why: `ActivityPublicSchema` requires `createdAt`, `status` and `imageUrls`, and
-- `UserSummarySchema` requires `gender`, `isVerified` and `interactionCount`.
-- The existing RPCs omitted these, which forced the mobile client to fabricate
-- defaults and blind-cast the JSONB payloads. This migration makes the database
-- the source of truth so the client can rigorously parse instead of guessing.

-- ---------------------------------------------------------------------------
-- 1. get_nearby_activities: add created_at, status and image_urls
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_nearby_activities(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

CREATE OR REPLACE FUNCTION public.get_nearby_activities(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  host_id UUID,
  interest_id TEXT,
  title TEXT,
  description TEXT,
  tier TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  venue_name TEXT,
  filter_gender gender_filter,
  filter_age_min INTEGER,
  filter_age_max INTEGER,
  expires_at TIMESTAMPTZ,
  max_participants INTEGER,
  current_participants_count INTEGER,
  distance_meters DOUBLE PRECISION,
  created_at TIMESTAMPTZ,
  status activity_status,
  image_urls TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.host_id,
    a.interest_id,
    a.title,
    a.description,
    a.tier,
    ST_Y(a.fuzzed_location::geometry),
    ST_X(a.fuzzed_location::geometry),
    a.venue_name,
    a.filter_gender,
    a.filter_age_min,
    a.filter_age_max,
    a.expires_at,
    a.max_participants,
    a.current_participants_count,
    ST_Distance(
      a.fuzzed_location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ),
    a.created_at,
    a.status,
    a.image_urls
  FROM public.activities AS a
  WHERE a.status IN ('open', 'full', 'in_progress')
    AND a.expires_at > NOW()
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
-- 2. get_activity_members: add gender, is_verified and interaction_count
--    so the roster payload satisfies UserSummarySchema without defaults.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_activity_members(UUID);

CREATE OR REPLACE FUNCTION public.get_activity_members(p_activity_id UUID)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  avatar_url TEXT,
  is_host BOOLEAN,
  trust_score DOUBLE PRECISION,
  gender user_gender,
  is_verified BOOLEAN,
  interaction_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Authorization: Verify caller is an accepted member or the host of this activity
  IF NOT EXISTS (
    SELECT 1 FROM public.activities a
    WHERE a.id = p_activity_id
      AND (
        a.host_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.activity_members m
          WHERE m.activity_id = p_activity_id AND m.user_id = auth.uid()
        )
      )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Caller is not an accepted member or host of activity %', p_activity_id;
  END IF;

  -- 2. Return roster joined with profiles (including host and all accepted members)
  RETURN QUERY
  WITH all_squad_users AS (
    SELECT
      m.user_id,
      m.is_host,
      m.joined_at
    FROM public.activity_members m
    WHERE m.activity_id = p_activity_id

    UNION

    SELECT
      a.host_id AS user_id,
      TRUE AS is_host,
      a.created_at AS joined_at
    FROM public.activities a
    WHERE a.id = p_activity_id
  )
  SELECT
    u.user_id,
    COALESCE(p.name, 'Hobbie Member')::TEXT AS name,
    p.avatar_url::TEXT AS avatar_url,
    u.is_host,
    COALESCE(p.trust_score, 5.0)::DOUBLE PRECISION AS trust_score,
    p.gender,
    COALESCE(p.is_verified, FALSE) AS is_verified,
    COALESCE(p.interaction_count, 0) AS interaction_count
  FROM all_squad_users u
  JOIN public.profiles p ON p.id = u.user_id
  ORDER BY u.is_host DESC, u.joined_at ASC;
END;
$$;

-- Security & Permissions
REVOKE EXECUTE ON FUNCTION public.get_activity_members(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_activity_members(UUID) TO authenticated, service_role;
