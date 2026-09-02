-- Enable PostGIS extension for geospatial radius queries
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  gender TEXT NOT NULL,
  interests TEXT[] NOT NULL DEFAULT '{}',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  trust_score NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
  interaction_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Activities Table
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interest_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  tier TEXT NOT NULL DEFAULT 'physical', -- 'physical' or 'virtual'
  location GEOMETRY(Point, 4326) NOT NULL, -- Exact location
  fuzzed_location GEOMETRY(Point, 4326) NOT NULL, -- Coarse fuzzed location (~100m) for unaccepted users
  venue_name TEXT,
  ttl_hours NUMERIC(3, 1) NOT NULL DEFAULT 3.0,
  expires_at TIMESTAMPTZ NOT NULL,
  max_participants INTEGER NOT NULL DEFAULT 5,
  current_participants_count INTEGER NOT NULL DEFAULT 1,
  filter_age_min INTEGER,
  filter_age_max INTEGER,
  filter_gender TEXT DEFAULT 'any',
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'full', 'in_progress', 'concluded', 'expired'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial index for sub-millisecond PostGIS ST_DWithin radius queries
CREATE INDEX IF NOT EXISTS idx_activities_fuzzed_location ON public.activities USING GIST (fuzzed_location);
CREATE INDEX IF NOT EXISTS idx_activities_expires_at ON public.activities (expires_at);

-- 3. Join Requests Table
CREATE TABLE IF NOT EXISTS public.join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'cancelled'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(activity_id, user_id)
);

-- 4. Activity Members Table (Ephemeral Room Membership)
CREATE TABLE IF NOT EXISTS public.activity_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(activity_id, user_id)
);

-- 5. Ephemeral Messages Table
CREATE TABLE IF NOT EXISTS public.room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_messages_activity_id ON public.room_messages (activity_id, created_at ASC);

-- 6. Ratings & Feedback Table
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Kept Connections Table (Post-activity 1:1 exception)
CREATE TABLE IF NOT EXISTS public.kept_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interest_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_a, user_b, interest_id)
);

-- PostGIS Discovery Stored Procedure
CREATE OR REPLACE FUNCTION get_nearby_activities(
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
    ST_Y(a.fuzzed_location::geometry) as lat,
    ST_X(a.fuzzed_location::geometry) as lng,
    a.venue_name,
    a.expires_at,
    a.max_participants,
    a.current_participants_count,
    ST_Distance(
      a.fuzzed_location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) as distance_meters
  FROM public.activities a
  WHERE a.status = 'open'
    AND a.expires_at > NOW()
    AND ST_DWithin(
      a.fuzzed_location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_km * 1000
    )
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;
