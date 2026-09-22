-- Migration: Host leave deletes an empty squad
--
-- Requirement: when the host leaves and no other members remain, the host must be
-- allowed to leave and the squad must be deleted altogether (not left behind as a
-- cancelled shell).
--
-- Why this was broken:
--   1. `leave_activity` required a row in `public.activity_members` for the caller.
--      Hosts are enrolled as members by the `tr_activity_host_member` trigger, but
--      any activity missing that row made the host unable to leave, raising
--      "User ... is not an active member of activity ...".
--   2. The previous host-departure branch could only run after passing that
--      membership check, so the true host could never reach leadership
--      reassignment when their member row was absent.
--
-- Behaviour after this migration:
--   * A caller is authorized if they are a member OR the activity's host.
--   * Host leaving with other members  -> host is reassigned to the earliest joiner.
--   * Host leaving with no members     -> the activity row is deleted (all child
--                                         rows cascade: members, messages, join
--                                         requests, ratings; reports detach).
--   * `current_participants_count` is recomputed from the roster instead of being
--     decremented, which also repairs prior count drift.

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
  v_is_host BOOLEAN;
  v_remaining_count INTEGER;
  v_new_count INTEGER;
  v_new_status activity_status;
  v_new_host_id UUID;
  v_next_host_id UUID;
  v_user_name TEXT;
BEGIN
  -- A. Verify caller authorization if authenticated via Supabase Auth
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Caller identity does not match user_id';
  END IF;

  -- B. Fetch and lock target activity row
  SELECT id, host_id, max_participants, current_participants_count, status, expires_at
  INTO v_activity
  FROM public.activities
  WHERE id = p_activity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity not found: %', p_activity_id;
  END IF;

  v_is_host := (v_activity.host_id = p_user_id);

  -- C. A caller is entitled to leave when they have a membership row OR they are
  --    the host. The host may legitimately lack a membership row.
  SELECT id, is_host, joined_at
  INTO v_member
  FROM public.activity_members
  WHERE activity_id = p_activity_id AND user_id = p_user_id;

  IF NOT FOUND AND NOT v_is_host THEN
    RAISE EXCEPTION 'User % is not an active member of activity %', p_user_id, p_activity_id;
  END IF;

  -- D. Remove the departing member row (the host may not have one)
  DELETE FROM public.activity_members
  WHERE activity_id = p_activity_id AND user_id = p_user_id;

  -- E. Identify the earliest-joined remaining member for leadership handover
  SELECT user_id INTO v_next_host_id
  FROM public.activity_members
  WHERE activity_id = p_activity_id
  ORDER BY joined_at ASC
  LIMIT 1;

  SELECT COUNT(*) INTO v_remaining_count
  FROM public.activity_members
  WHERE activity_id = p_activity_id;

  -- F. Host leaving with nobody else: delete the squad altogether.
  --    Child rows cascade (activity_members, room_messages, join_requests, ratings);
  --    reports keep their row with a null activity_id.
  IF v_is_host AND v_next_host_id IS NULL THEN
    DELETE FROM public.activities WHERE id = p_activity_id;

    RETURN jsonb_build_object(
      'success', true,
      'activity_id', p_activity_id,
      'user_id', p_user_id,
      'new_host_id', NULL,
      'current_participants_count', 0,
      'status', 'cancelled'
    );
  END IF;

  -- G. Graceful leadership reassignment when the host leaves with members behind
  v_new_host_id := v_activity.host_id;
  IF v_is_host THEN
    v_new_host_id := v_next_host_id;
    UPDATE public.activity_members
    SET is_host = TRUE
    WHERE activity_id = p_activity_id AND user_id = v_next_host_id;
  END IF;

  -- H. Recompute participant count from the roster (robust to prior drift)
  v_new_count := v_remaining_count;

  -- I. If the activity was full and is still live, reopen it
  IF v_activity.status = 'full'::activity_status AND v_activity.expires_at > NOW() THEN
    v_new_status := 'open'::activity_status;
  ELSE
    v_new_status := v_activity.status;
  END IF;

  -- J. Update the activity
  UPDATE public.activities
  SET
    current_participants_count = v_new_count,
    status = v_new_status,
    host_id = v_new_host_id
  WHERE id = p_activity_id;

  -- K. Cancel the departing caller's pending/accepted join request
  UPDATE public.join_requests
  SET status = 'cancelled'::join_request_status
  WHERE activity_id = p_activity_id AND user_id = p_user_id;

  -- L. Post system leave notification to room messages
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

-- Preserve explicit permissions (CREATE OR REPLACE keeps them, re-issued for clarity)
REVOKE EXECUTE ON FUNCTION public.leave_activity(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_activity(UUID, UUID) TO authenticated, service_role;