-- Migration: 20260915000002_get_activity_members_rpc.sql
-- Description: Add get_activity_members RPC to return squad roster with profiles, resolving RLS privacy barrier.

CREATE OR REPLACE FUNCTION public.get_activity_members(p_activity_id UUID)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  avatar_url TEXT,
  is_host BOOLEAN,
  trust_score DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Authorization: Verify caller is an accepted member or the host of this activity
  IF NOT EXISTS (
    SELECT 1 FROM public.activities a
    WHERE a.id = p_activity_id
      AND (
        a.host_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.activity_members m
          WHERE m.activity_id = p_activity_id AND m.user_id = auth.uid()
        )
      )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Caller is not an accepted member or host of activity %', p_activity_id;
  END IF;

  -- 2. Return roster joined with profiles (including host and all accepted members)
  RETURN QUERY
  WITH all_squad_users AS (
    SELECT 
      m.user_id,
      m.is_host,
      m.joined_at
    FROM public.activity_members m
    WHERE m.activity_id = p_activity_id

    UNION

    SELECT 
      a.host_id AS user_id,
      TRUE AS is_host,
      a.created_at AS joined_at
    FROM public.activities a
    WHERE a.id = p_activity_id
  )
  SELECT 
    u.user_id,
    COALESCE(p.name, 'Hobbie Member')::TEXT AS name,
    p.avatar_url::TEXT AS avatar_url,
    u.is_host,
    COALESCE(p.trust_score, 5.0)::DOUBLE PRECISION AS trust_score
  FROM all_squad_users u
  JOIN public.profiles p ON p.id = u.user_id
  ORDER BY u.is_host DESC, u.joined_at ASC;
END;
$$;

-- Security & Permissions
REVOKE EXECUTE ON FUNCTION public.get_activity_members(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_activity_members(UUID) TO authenticated, service_role;
