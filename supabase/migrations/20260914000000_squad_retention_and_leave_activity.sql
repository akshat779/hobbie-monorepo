-- Migration: Squad Retention and Atomic Leave Activity Procedure
-- Milestone: Post-TTL Squad Transformation & WhatsApp-style Leave Squad

-- 1. Atomic Stored Procedure: Leave Activity
CREATE OR REPLACE FUNCTION public.leave_activity(
  p_activity_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity RECORD;
  v_member RECORD;
  v_new_count INTEGER;
  v_new_status activity_status;
  v_new_host_id UUID;
  v_next_host_id UUID;
  v_user_name TEXT;
BEGIN
  -- Verify caller authorization if authenticated via Supabase Auth
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Caller identity does not match user_id';
  END IF;

  -- A. Fetch and lock target activity row
  SELECT id, host_id, max_participants, current_participants_count, status, expires_at
  INTO v_activity
  FROM public.activities
  WHERE id = p_activity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity not found: %', p_activity_id;
  END IF;

  -- B. Verify caller membership in activity_members
  SELECT id, is_host, joined_at
  INTO v_member
  FROM public.activity_members
  WHERE activity_id = p_activity_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % is not an active member of activity %', p_user_id, p_activity_id;
  END IF;

  -- C. Remove departing member
  DELETE FROM public.activity_members
  WHERE activity_id = p_activity_id AND user_id = p_user_id;

  -- D. Decrement current participant count
  v_new_count := GREATEST(0, v_activity.current_participants_count - 1);

  -- E. Determine new status: if activity was full and not yet expired, reopen it
  IF v_activity.status = 'full'::activity_status AND v_activity.expires_at > NOW() THEN
    v_new_status := 'open'::activity_status;
  ELSE
    v_new_status := v_activity.status;
  END IF;

  -- F. Handle host departure with graceful leadership reassignment
  v_new_host_id := v_activity.host_id;
  IF v_member.is_host THEN
    -- Find the earliest joined remaining member
    SELECT user_id INTO v_next_host_id
    FROM public.activity_members
    WHERE activity_id = p_activity_id
    ORDER BY joined_at ASC
    LIMIT 1;

    IF v_next_host_id IS NOT NULL THEN
      v_new_host_id := v_next_host_id;
      UPDATE public.activity_members
      SET is_host = TRUE
      WHERE activity_id = p_activity_id AND user_id = v_next_host_id;
    ELSE
      -- No members remain, cancel activity
      v_new_status := 'cancelled'::activity_status;
    END IF;
  END IF;

  -- G. Update target activity
  UPDATE public.activities
  SET
    current_participants_count = v_new_count,
    status = v_new_status,
    host_id = v_new_host_id
  WHERE id = p_activity_id;

  -- H. Cancel any pending or accepted join request
  UPDATE public.join_requests
  SET status = 'cancelled'::join_request_status
  WHERE activity_id = p_activity_id AND user_id = p_user_id;

  -- I. Post system leave notification to room messages
  SELECT name INTO v_user_name FROM public.profiles WHERE id = p_user_id;
  INSERT INTO public.room_messages (activity_id, sender_id, content)
  VALUES (
    p_activity_id,
    p_user_id,
    COALESCE(v_user_name, 'A member') || ' left the squad'
  );

  RETURN jsonb_build_object(
    'success', true,
    'activity_id', p_activity_id,
    'user_id', p_user_id,
    'new_host_id', v_new_host_id,
    'current_participants_count', v_new_count,
    'status', v_new_status
  );
END;
$$;

-- 2. Update Activities SELECT policy so host and accepted members can always access
DROP POLICY IF EXISTS "Active activities are viewable by authenticated users" ON public.activities;
DROP POLICY IF EXISTS "Activities are viewable by authenticated users" ON public.activities;

CREATE POLICY "Activities are viewable by authenticated users"
ON public.activities FOR SELECT TO authenticated
USING (
  -- Publicly discoverable if active and unexpired
  (status IN ('open', 'full', 'in_progress') AND expires_at > NOW())
  OR
  -- Always visible to the host
  (host_id = (select auth.uid()))
  OR
  -- Always visible to accepted members
  EXISTS (
    SELECT 1 FROM public.activity_members
    WHERE activity_members.activity_id = activities.id
      AND activity_members.user_id = (select auth.uid())
  )
);

-- 3. Update get_activity_exact_location to allow post-TTL coordinate access for members
CREATE OR REPLACE FUNCTION public.get_activity_exact_location(p_activity_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('latitude', ST_Y(a.location::geometry), 'longitude', ST_X(a.location::geometry))
  FROM public.activities a
  WHERE a.id = p_activity_id
    AND (a.host_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.activity_members m WHERE m.activity_id = a.id AND m.user_id = auth.uid()
    ));
$$;

-- 4. Set function permissions
REVOKE EXECUTE ON FUNCTION public.leave_activity(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_activity(UUID, UUID) TO authenticated, service_role;
