-- Harden privileged RPCs, privacy boundaries, and realtime room access.

CREATE OR REPLACE FUNCTION public.accept_join_request_tx(p_request_id UUID, p_host_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; a RECORD; new_count INTEGER; new_status activity_status;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_host_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT id, activity_id, user_id, status INTO r FROM public.join_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Join request not found: %', p_request_id; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Join request is already processed'; END IF;
  SELECT id, host_id, max_participants, current_participants_count, status INTO a
    FROM public.activities WHERE id = r.activity_id FOR UPDATE;
  IF NOT FOUND OR a.host_id <> p_host_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF a.current_participants_count >= a.max_participants THEN RAISE EXCEPTION 'Activity capacity reached'; END IF;
  UPDATE public.join_requests SET status = 'accepted'::join_request_status WHERE id = p_request_id;
  INSERT INTO public.activity_members(activity_id, user_id, is_host)
    VALUES (r.activity_id, r.user_id, FALSE) ON CONFLICT (activity_id, user_id) DO NOTHING;
  new_count := a.current_participants_count + 1;
  new_status := CASE WHEN new_count >= a.max_participants THEN 'full'::activity_status ELSE a.status END;
  UPDATE public.activities SET current_participants_count = new_count, status = new_status WHERE id = a.id;
  RETURN jsonb_build_object('success', true, 'activity_id', a.id, 'request_id', p_request_id,
    'user_id', r.user_id, 'current_participants_count', new_count, 'status', new_status);
END; $$;

CREATE OR REPLACE FUNCTION public.decline_join_request(p_request_id UUID, p_host_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; a RECORD;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_host_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT id, activity_id INTO r FROM public.join_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Join request not found: %', p_request_id; END IF;
  SELECT id, host_id INTO a FROM public.activities WHERE id = r.activity_id;
  IF NOT FOUND OR a.host_id <> p_host_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.join_requests SET status = 'declined'::join_request_status WHERE id = p_request_id;
  RETURN jsonb_build_object('success', true, 'activity_id', a.id, 'request_id', p_request_id, 'status', 'declined');
END; $$;

CREATE OR REPLACE FUNCTION public.request_to_join_activity(p_activity_id UUID, p_user_id UUID, p_message TEXT DEFAULT '')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; a RECORD;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT id, host_id, status INTO a FROM public.activities WHERE id = p_activity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Activity not found: %', p_activity_id; END IF;
  IF a.status <> 'open' THEN RAISE EXCEPTION 'Activity is not open for joining'; END IF;
  IF a.host_id = p_user_id THEN RAISE EXCEPTION 'Host cannot request to join their own activity'; END IF;
  INSERT INTO public.join_requests(activity_id, user_id, message, status)
    VALUES (p_activity_id, p_user_id, COALESCE(p_message, ''), 'pending'::join_request_status)
    ON CONFLICT (activity_id, user_id) DO UPDATE SET
      message = CASE WHEN EXCLUDED.message <> '' THEN EXCLUDED.message ELSE join_requests.message END,
      status = CASE WHEN join_requests.status = 'declined' THEN 'pending'::join_request_status ELSE join_requests.status END
    RETURNING id, activity_id, user_id, message, status, created_at INTO r;
  RETURN jsonb_build_object('id', r.id, 'activity_id', r.activity_id, 'user_id', r.user_id,
    'message', r.message, 'status', r.status, 'created_at', r.created_at);
END; $$;

CREATE OR REPLACE FUNCTION public.update_user_location(p_user_id UUID, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_geohash TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.profiles SET last_location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326),
    coarse_geohash = p_geohash, last_active_at = NOW(), updated_at = NOW() WHERE id = p_user_id;
END; $$;

-- Exact coordinates are available only to the host or an accepted member.
CREATE OR REPLACE FUNCTION public.get_activity_exact_location(p_activity_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('latitude', ST_Y(a.location::geometry), 'longitude', ST_X(a.location::geometry))
  FROM public.activities a
  WHERE a.id = p_activity_id AND a.expires_at > NOW()
    AND (a.host_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.activity_members m WHERE m.activity_id = a.id AND m.user_id = auth.uid()
    ));
$$;

REVOKE EXECUTE ON FUNCTION public.accept_join_request_tx(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decline_join_request(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_to_join_activity(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_user_location(UUID, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_activity_exact_location(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_join_request_tx(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_join_request(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_to_join_activity(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_user_location(UUID, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_activity_exact_location(UUID) TO authenticated, service_role;

-- Expose only non-sensitive profile/activity columns through the Data API.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, name, birth_date, gender, interests, is_verified, trust_score,
  interaction_count, avatar_url, created_at, updated_at) ON public.profiles TO authenticated;
REVOKE SELECT (location) ON public.activities FROM authenticated;

DROP POLICY IF EXISTS "Hosts can update their own activities" ON public.activities;
CREATE POLICY "Hosts can update their own activities" ON public.activities FOR UPDATE TO authenticated
  USING ((select auth.uid()) = host_id) WITH CHECK ((select auth.uid()) = host_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Hosts can update join request status" ON public.join_requests;
CREATE POLICY "Hosts can update join request status" ON public.join_requests FOR UPDATE TO authenticated
  USING ((select auth.uid()) IN (SELECT host_id FROM public.activities WHERE id = activity_id))
  WITH CHECK ((select auth.uid()) IN (SELECT host_id FROM public.activities WHERE id = activity_id));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'room_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
  END IF;
END $$;
