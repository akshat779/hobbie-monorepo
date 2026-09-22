-- 20260922000002_tighten_preferred_languages_and_avatar_read_policy.sql
-- Follow-up to 20260922000001:
--   1. Enforce the mandatory 1-3 + uniqueness rule on preferred_languages so the
--      database matches packages/shared/src/schemas/user.schema.ts (tri-layer parity).
--   2. Scope the avatars read policy to the caller's own folder instead of PUBLIC,
--      removing anonymous bucket listing/enumeration.
--
-- NOTE: uniqueness cannot be expressed inline in a CHECK (subqueries are not
-- allowed there), so it lives in the IMMUTABLE helper below.

-- ---------------------------------------------------------------------------
-- 1. Initialise the brand-new column for rows created before the constraint.
--    preferred_languages was introduced empty by 20260922000001 and has never
--    been user-editable, so this is a bounded initialisation, not a data reprocess.
-- ---------------------------------------------------------------------------
UPDATE public.profiles
SET preferred_languages = ARRAY['en']::TEXT[]
WHERE cardinality(preferred_languages) = 0;

-- ---------------------------------------------------------------------------
-- 2. IMMUTABLE validator: 1-3 languages, unique, drawn from the catalogue.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preferred_languages_are_valid(langs TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT cardinality(langs) BETWEEN 1 AND 3
    AND cardinality(langs) = cardinality(ARRAY(SELECT DISTINCT unnest(langs)))
    AND langs <@ ARRAY[
      'en', 'hi', 'bn', 'ta', 'te', 'mr', 'kn', 'ml', 'gu', 'pa', 'ur',
      'es', 'fr', 'de', 'ar', 'zh', 'ja'
    ]::TEXT[];
$$;

-- ---------------------------------------------------------------------------
-- 3. Replace the permissive constraint with the full parity rule.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS check_preferred_languages;

ALTER TABLE public.profiles
  ADD CONSTRAINT check_preferred_languages
  CHECK (public.preferred_languages_are_valid(preferred_languages));

-- ---------------------------------------------------------------------------
-- 4. Restrict avatar reads to the caller's own folder (public buckets already
--    serve objects by direct URL without a SELECT policy).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
CREATE POLICY "Users can read their own avatars"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
