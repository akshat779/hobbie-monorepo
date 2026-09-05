-- Migration: Add atomic handshake transactions with row-level locking
-- Milestone 3: Squad Creation & Join Handshake

-- 1. Atomic Stored Procedure: Accept Join Request
CREATE OR REPLACE FUNCTION public.accept_join_request_tx(
  p_request_id UUID,
  p_host_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_activity RECORD;
  v_new_count INTEGER;
  v_new_status activity_status;
BEGIN
  -- Verify caller authorization if authenticated via Supabase Auth
  IF auth.uid() IS NOT NULL AND auth.uid() != p_host_id THEN
    RAISE EXCEPTION 'Unauthorized: Caller identity does not match host';
  END IF;

  -- A. Fetch and lock the join request
  SELECT id, activity_id, user_id, status
  INTO v_request
  FROM public.join_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request not found: %', p_request_id;
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Join request is already processed with status: %', v_request.status;
  END IF;

  -- B. Lock target activity row FOR UPDATE to eliminate concurrent overbooking race conditions
  SELECT id, host_id, max_participants, current_participants_count, status
  INTO v_activity
  FROM public.activities
  WHERE id = v_request.activity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity not found: %', v_request.activity_id;
  END IF;

  -- C. Verify host ownership
  IF v_activity.host_id != p_host_id THEN
    RAISE EXCEPTION 'Unauthorized: user % is not the host of activity %', p_host_id, v_activity.id;
  END IF;

  -- D. Enforce capacity constraints
  IF v_activity.current_participants_count >= v_activity.max_participants THEN
    RAISE EXCEPTION 'Activity capacity reached (% of %)', v_activity.current_participants_count, v_activity.max_participants;
  END IF;

  -- E. Update join request status to accepted
  UPDATE public.join_requests
  SET status = 'accepted'::join_request_status
  WHERE id = p_request_id;

  -- F. Insert accepted requester into activity_members
  INSERT INTO public.activity_members (activity_id, user_id, is_host)
  VALUES (v_request.activity_id, v_request.user_id, FALSE)
  ON CONFLICT (activity_id, user_id) DO NOTHING;

  -- G. Increment current_participants_count and update status if full
  v_new_count := v_activity.current_participants_count + 1;
  IF v_new_count >= v_activity.max_participants THEN
    v_new_status := 'full'::activity_status;
  ELSE
    v_new_status := v_activity.status;
  END IF;

  UPDATE public.activities
  SET
    current_participants_count = v_new_count,
    status = v_new_status
  WHERE id = v_activity.id;

  RETURN jsonb_build_object(
    'success', true,
    'activity_id', v_activity.id,
    'request_id', p_request_id,
    'user_id', v_request.user_id,
    'current_participants_count', v_new_count,
    'status', v_new_status
  );
END;
$$;

-- 2. Stored Procedure: Decline Join Request
CREATE OR REPLACE FUNCTION public.decline_join_request(
  p_request_id UUID,
  p_host_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_activity RECORD;
BEGIN
  -- Verify caller authorization if authenticated via Supabase Auth
  IF auth.uid() IS NOT NULL AND auth.uid() != p_host_id THEN
    RAISE EXCEPTION 'Unauthorized: Caller identity does not match host';
  END IF;

  -- A. Fetch and lock join request
  SELECT id, activity_id, user_id, status
  INTO v_request
  FROM public.join_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request not found: %', p_request_id;
  END IF;

  -- B. Fetch activity to verify host
  SELECT id, host_id
  INTO v_activity
  FROM public.activities
  WHERE id = v_request.activity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity not found: %', v_request.activity_id;
  END IF;

  -- C. Verify host ownership
  IF v_activity.host_id != p_host_id THEN
    RAISE EXCEPTION 'Unauthorized: user % is not the host of activity %', p_host_id, v_activity.id;
  END IF;

  -- D. Update join request status to declined
  UPDATE public.join_requests
  SET status = 'declined'::join_request_status
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'activity_id', v_activity.id,
    'request_id', p_request_id,
    'status', 'declined'
  );
END;
$$;

-- 3. Atomic Stored Procedure: Request to Join Activity
CREATE OR REPLACE FUNCTION public.request_to_join_activity(
  p_activity_id UUID,
  p_user_id UUID,
  p_message TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_activity RECORD;
BEGIN
  -- Verify caller authorization if authenticated via Supabase Auth
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Caller identity does not match user_id';
  END IF;

  -- Validate activity exists and is open
  SELECT id, host_id, max_participants, current_participants_count, status
  INTO v_activity
  FROM public.activities
  WHERE id = p_activity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity not found: %', p_activity_id;
  END IF;

  IF v_activity.status != 'open' THEN
    RAISE EXCEPTION 'Activity is not open for joining (status: %)', v_activity.status;
  END IF;

  IF v_activity.host_id = p_user_id THEN
    RAISE EXCEPTION 'Host cannot request to join their own activity';
  END IF;

  -- Insert or update existing request
  INSERT INTO public.join_requests (activity_id, user_id, message, status)
  VALUES (p_activity_id, p_user_id, COALESCE(p_message, ''), 'pending'::join_request_status)
  ON CONFLICT (activity_id, user_id)
  DO UPDATE SET
    message = CASE WHEN EXCLUDED.message <> '' THEN EXCLUDED.message ELSE join_requests.message END,
    status = CASE WHEN join_requests.status = 'declined' THEN 'pending'::join_request_status ELSE join_requests.status END
  RETURNING id, activity_id, user_id, message, status, created_at
  INTO v_request;

  RETURN jsonb_build_object(
    'id', v_request.id,
    'activity_id', v_request.activity_id,
    'user_id', v_request.user_id,
    'message', v_request.message,
    'status', v_request.status,
    'created_at', v_request.created_at
  );
END;
$$;

-- 4. Trigger: Automatically enroll squad host into activity_members
CREATE OR REPLACE FUNCTION public.handle_new_activity_host_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_members (activity_id, user_id, is_host)
  VALUES (NEW.id, NEW.host_id, TRUE)
  ON CONFLICT (activity_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_activity_host_member ON public.activities;
CREATE TRIGGER tr_activity_host_member
AFTER INSERT ON public.activities
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_activity_host_member();

-- 5. Enable Supabase Realtime broadcast for join requests and activities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'join_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.join_requests;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'activities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
  END IF;
END $$;

-- 6. Execution Permissions
GRANT EXECUTE ON FUNCTION public.accept_join_request_tx(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_join_request(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_to_join_activity(UUID, UUID, TEXT) TO authenticated, service_role;
