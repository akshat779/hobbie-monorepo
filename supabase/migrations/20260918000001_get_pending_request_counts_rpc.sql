-- Migration: 20260918000001_get_pending_request_counts_rpc.sql
-- Description: Batch RPC returning pending join-request counts for a set of
--              activities in a single round trip. Replaces the client-side N+1
--              fan-out of one COUNT query per hosted squad.
--
-- Security: SECURITY DEFINER so the aggregate is not filtered by the caller's
--           join_requests RLS, but the result is explicitly scoped to activities
--           hosted by the caller (a.host_id = auth.uid()). Callers can never read
--           pending counts for activities they do not host.

CREATE OR REPLACE FUNCTION public.get_pending_request_counts(
  p_activity_ids UUID[]
)
RETURNS TABLE (
  activity_id UUID,
  pending_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jr.activity_id,
    COUNT(*)::BIGINT AS pending_count
  FROM public.join_requests AS jr
  JOIN public.activities AS a ON a.id = jr.activity_id
  WHERE jr.activity_id = ANY(p_activity_ids)
    AND jr.status = 'pending'::join_request_status
    AND a.host_id = auth.uid()
  GROUP BY jr.activity_id;
$$;

-- Security & Permissions
REVOKE ALL ON FUNCTION public.get_pending_request_counts(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pending_request_counts(UUID[]) TO authenticated, service_role;