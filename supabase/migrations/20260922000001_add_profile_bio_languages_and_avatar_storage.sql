-- 20260922000001_add_profile_bio_languages_and_avatar_storage.sql
-- Adds optional bio + mandatory preferred languages to public.profiles and
-- provisions the public `avatars` Storage bucket with per-user RLS policies.
--
-- Tri-layer parity: mirrors packages/shared/src/constants/languages.ts and
-- packages/shared/src/schemas/user.schema.ts.

-- ---------------------------------------------------------------------------
-- 1. New profile columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS preferred_languages TEXT[] NOT NULL DEFAULT '{}';

-- ---------------------------------------------------------------------------
-- 2. Constraints (mirror shared Zod boundaries)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS check_bio_length,
  ADD CONSTRAINT check_bio_length CHECK (bio IS NULL OR char_length(bio) <= 160);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS check_preferred_languages,
  ADD CONSTRAINT check_preferred_languages CHECK (
    cardinality(preferred_languages) <= 3
    AND preferred_languages <@ ARRAY[
      'en', 'hi', 'bn', 'ta', 'te', 'mr', 'kn', 'ml', 'gu', 'pa', 'ur',
      'es', 'fr', 'de', 'ar', 'zh', 'ja'
    ]::TEXT[]
  );

-- ---------------------------------------------------------------------------
-- 3. Column-level Data API grants
-- SELECT was revoked on public.profiles and re-granted column-by-column in
-- 20260906071836_harden_dev_auth_and_room_privacy.sql, so new readable columns
-- must be granted explicitly.
-- ---------------------------------------------------------------------------
GRANT SELECT (bio, preferred_languages) ON public.profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Avatars Storage bucket (public read, per-user write)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 5. Storage RLS policies (objects live under <auth.uid()>/... )
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
CREATE POLICY "Avatar images are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
