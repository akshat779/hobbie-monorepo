-- Membership checks must be able to read the caller's own row without a
-- recursive self-referential policy. The room service only needs this row;
-- other members remain private.
DROP POLICY IF EXISTS "Room members can view other members" ON public.activity_members;
CREATE POLICY "Members can view their own membership"
ON public.activity_members FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

-- Reassert the RPC privilege after the function replacement migration. The
-- mobile client uses an authenticated JWT, never the service role key.
REVOKE ALL ON FUNCTION public.get_nearby_activities(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_nearby_activities(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- Keep all tables consumed by mobile Realtime subscriptions in the publication.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'activities') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'join_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.join_requests;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'room_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
  END IF;
END $$;
