-- Hide squads the caller is already part of from public discovery.
--
-- Once a join request is accepted the caller gains an `activity_members` row
-- (hosts are auto-enrolled by the `tr_activity_host_member` trigger), so the
-- map pin and feed card are redundant — the squad is already reachable under
-- "My Squads". Leaving a squad deletes the membership row, so while the activity
-- is still live (`open`/`full`/`in_progress` and unexpired) it becomes
-- discoverable to that user again.
--
-- Both the Map and the Feed consume this single RPC, so this is the only place
-- the membership exclusion needs to be applied.
--
-- `auth.uid()` can be NULL for a non-session caller; `IS DISTINCT FROM` and the
-- NULL-safe NOT EXISTS keep discovery returning everything in that case (the
-- function is only executable by `authenticated` anyway).

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
    -- Never surface the caller's own hosted squad.
    AND a.host_id IS DISTINCT FROM caller_id
    -- Never surface a squad the caller is already an accepted member of.
    AND NOT EXISTS (
      SELECT 1
      FROM public.activity_members AS m
      WHERE m.activity_id = a.id
        AND m.user_id = caller_id
    )
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
