-- 1. Create Enums for strict database type safety
DO $$ BEGIN
    CREATE TYPE user_gender AS ENUM ('male', 'female', 'non-binary', 'prefer-not-to-say');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE gender_filter AS ENUM ('any', 'male-only', 'female-only');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE activity_status AS ENUM ('open', 'full', 'in_progress', 'concluded', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE join_request_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Drop dependent policies before altering column types
DROP POLICY IF EXISTS "Active activities are viewable by authenticated users" ON public.activities;
DROP POLICY IF EXISTS "Requesters and hosts can view join requests" ON public.join_requests;

-- 3. Enhance Profiles Table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS last_location GEOMETRY(Point, 4326),
  ADD COLUMN IF NOT EXISTS coarse_geohash TEXT,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

-- Convert gender to enum
ALTER TABLE public.profiles 
  ALTER COLUMN gender TYPE user_gender USING (
    CASE 
      WHEN gender IN ('male', 'female', 'non-binary', 'prefer-not-to-say') THEN gender::user_gender 
      ELSE 'prefer-not-to-say'::user_gender 
    END
  );

-- Add E.164 phone format validation check
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS check_e164_phone,
  ADD CONSTRAINT check_e164_phone CHECK (phone ~ '^\+[1-9]\d{1,14}$');

-- Spatial index on user's coarse location for background radius matching / reverse nudges
CREATE INDEX IF NOT EXISTS idx_profiles_last_location ON public.profiles USING GIST (last_location);
CREATE INDEX IF NOT EXISTS idx_profiles_coarse_geohash ON public.profiles (coarse_geohash);

-- 4. Enhance Activities Table
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- Convert activity status to enum with clean default transition
ALTER TABLE public.activities ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.activities ALTER COLUMN status TYPE activity_status USING status::activity_status;
ALTER TABLE public.activities ALTER COLUMN status SET DEFAULT 'open'::activity_status;

-- Convert filter_gender to enum with clean default transition
ALTER TABLE public.activities ALTER COLUMN filter_gender DROP DEFAULT;
ALTER TABLE public.activities ALTER COLUMN filter_gender TYPE gender_filter USING (
  CASE 
    WHEN filter_gender IN ('any', 'male-only', 'female-only') THEN filter_gender::gender_filter 
    ELSE 'any'::gender_filter 
  END
);
ALTER TABLE public.activities ALTER COLUMN filter_gender SET DEFAULT 'any'::gender_filter;

-- Convert join_requests status to enum with clean default transition
ALTER TABLE public.join_requests ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.join_requests ALTER COLUMN status TYPE join_request_status USING status::join_request_status;
ALTER TABLE public.join_requests ALTER COLUMN status SET DEFAULT 'pending'::join_request_status;

-- 5. Recreate RLS Policies with Enum Types
CREATE POLICY "Active activities are viewable by authenticated users"
ON public.activities FOR SELECT TO authenticated
USING (status IN ('open', 'full', 'in_progress') AND expires_at > NOW());

CREATE POLICY "Requesters and hosts can view join requests"
ON public.join_requests FOR SELECT TO authenticated
USING (
  auth.uid() = user_id OR
  auth.uid() IN (SELECT host_id FROM public.activities WHERE id = activity_id)
);

-- 6. Helper Function: Update User Location & Geohash Bucket
CREATE OR REPLACE FUNCTION update_user_location(
  p_user_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_geohash TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET
    last_location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326),
    coarse_geohash = p_geohash,
    last_active_at = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
