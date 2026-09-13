-- Canonical activity coordinates remain exact in `location`; `fuzzed_location`
-- is the public discovery coordinate. The client never uses the fuzzed point as
-- the source of truth when a host selects a venue.
ALTER TABLE public.activities
  DROP CONSTRAINT IF EXISTS activities_age_range_valid,
  ADD CONSTRAINT activities_age_range_valid CHECK (
    (filter_age_min IS NULL OR filter_age_min BETWEEN 18 AND 99)
    AND (filter_age_max IS NULL OR filter_age_max BETWEEN 18 AND 99)
    AND (filter_age_min IS NULL OR filter_age_max IS NULL OR filter_age_min <= filter_age_max)
  );

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
  distance_meters DOUBLE PRECISION
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
    )
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
