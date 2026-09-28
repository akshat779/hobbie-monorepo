-- 20260927000001_raise_avatar_size_limit.sql
-- The client now re-encodes every picked photo to a downscaled JPEG before
-- upload, so real payloads are small. Raise the bucket ceiling anyway so an
-- unusually large original can never be rejected outright by Storage.
UPDATE storage.buckets
SET file_size_limit = 15728640 -- 15 MiB
WHERE id = 'avatars';
