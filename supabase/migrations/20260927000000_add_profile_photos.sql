-- 20260927000000_add_profile_photos.sql
-- Adds a gallery of profile photos to public.profiles. The first entry is the
-- cover photo and mirrors avatar_url so existing discovery/roster/room surfaces
-- keep working unchanged.
--
-- Tri-layer parity: mirrors MAX_PROFILE_PHOTOS + UserProfileSchema.photoUrls in
-- packages/shared.

-- ---------------------------------------------------------------------------
-- 1. New profile column
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] NOT NULL DEFAULT '{}';

-- ---------------------------------------------------------------------------
-- 2. Constraints (mirror shared Zod boundaries)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS check_photo_urls_count,
  ADD CONSTRAINT check_photo_urls_count CHECK (cardinality(photo_urls) <= 6);

-- ---------------------------------------------------------------------------
-- 3. Column-level Data API grants
-- SELECT was revoked on public.profiles and re-granted column-by-column in
-- 20260906071836_harden_dev_auth_and_room_privacy.sql, so new readable columns
-- must be granted explicitly.
-- ---------------------------------------------------------------------------
GRANT SELECT (photo_urls) ON public.profiles TO authenticated;
