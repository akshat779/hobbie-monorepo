import { supabase } from './supabase';
import {
  AcceptJoinRequestResult,
  AcceptJoinRequestResultSchema,
  Database,
  DeclineJoinRequestResult,
  DeclineJoinRequestResultSchema,
  JoinRequestPublic,
  JoinRequestPublicSchema,
  JoinRequestRealtimeRowSchema,
  LeaveActivityResult,
  LeaveActivityResultSchema,
  PendingRequestCountRowsSchema,
  RequestToJoinResult,
  RequestToJoinResultSchema,
} from '@hobbie/shared';
import { subscribeToPostgresChanges } from './realtimePool';

export type JoinRequestRow = Database['public']['Tables']['join_requests']['Row'];
export type ActivityRow = Database['public']['Tables']['activities']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];

const joinRequestSelect = 'id, activity_id, user_id, message, status, created_at';

/**
 * Creates a pending join request for an activity.
 * Uses the atomic SECURITY DEFINER RPC. Direct inserts are intentionally not
 * used because they would bypass the activity-state and capacity invariants.
 *
 * The JSONB payload is validated against the shared contract before it is
 * returned, so a backend shape change can never leak a malformed object into
 * the React Query cache.
 *
 * Throws on failure so TanStack Query mutation `onError` rollback handlers fire.
 * Callers must wrap this in try/catch (or rely on `mutateAsync` rejection).
 */
export async function requestToJoin(
  activityId: string,
  userId: string,
  message: string = ''
): Promise<RequestToJoinResult> {
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'request_to_join_activity',
    {
      p_activity_id: activityId,
      p_user_id: userId,
      p_message: message.trim(),
    }
  );

  if (rpcError) {
    throw new Error(rpcError.message || 'Failed to submit join request');
  }

  if (!rpcData) {
    throw new Error('Atomic join-request operation is unavailable');
  }

  const parsed = RequestToJoinResultSchema.safeParse(rpcData);
  if (!parsed.success) {
    throw new Error('Atomic join-request operation returned an unexpected payload');
  }

  return parsed.data;
}

/**
 * Fetches the current user's join request status for a given activity.
 *
 * Returns the same normalized projection as `requestToJoin` so both writers of
 * the `joinStatus` query cache agree on a single contract.
 */
export async function getJoinRequestStatus(
  activityId: string,
  userId: string
): Promise<RequestToJoinResult | null> {
  try {
    const { data, error } = await supabase
      .from('join_requests')
      .select(joinRequestSelect)
      .eq('activity_id', activityId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const parsed = RequestToJoinResultSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Counts pending join requests for a single activity.
 */
export async function getPendingRequestsCount(activityId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('join_requests')
      .select('*', { count: 'exact', head: true })
      .eq('activity_id', activityId)
      .eq('status', 'pending');

    if (error || typeof count !== 'number') {
      return 0;
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Batch-fetches pending join-request counts for many activities in a single RPC
 * round trip, eliminating the per-squad N+1 query fan-out.
 *
 * The RPC only returns rows for activities hosted by the authenticated caller.
 * Missing activities simply have no entry in the returned Map.
 */
export async function getPendingRequestCounts(
  activityIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (activityIds.length === 0) {
    return counts;
  }

  const { data, error } = await supabase.rpc('get_pending_request_counts', {
    p_activity_ids: activityIds,
  });

  if (error) {
    console.warn('get_pending_request_counts RPC error:', error.message);
    return counts;
  }

  const parsed = PendingRequestCountRowsSchema.safeParse(data ?? []);
  if (!parsed.success) {
    console.warn(
      'get_pending_request_counts payload failed contract validation:',
      parsed.error.flatten()
    );
    return counts;
  }

  for (const row of parsed.data) {
    counts.set(row.activity_id, row.pending_count);
  }

  return counts;
}

/**
 * Fetches incoming join requests for an activity hosted by the current user.
 * Every item is validated through `JoinRequestPublicSchema`; malformed rows are
 * skipped with a warning rather than rendered with fabricated defaults.
 */
export async function fetchIncomingJoinRequests(
  activityId: string
): Promise<JoinRequestPublic[]> {
  try {
    const { data, error } = await supabase
      .from('join_requests')
      .select(`
        id,
        activity_id,
        user_id,
        message,
        status,
        created_at,
        profiles (
          id,
          name,
          trust_score,
          is_verified,
          avatar_url,
          gender,
          interaction_count
        )
      `)
      .eq('activity_id', activityId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error || !data) {
      return [];
    }

    const requests: JoinRequestPublic[] = [];

    for (const item of data) {
      const profile = item.profiles;
      if (!profile) {
        console.warn(
          `fetchIncomingJoinRequests skipped request ${item.id}: joined profile unavailable`
        );
        continue;
      }

      const parsed = JoinRequestPublicSchema.safeParse({
        id: item.id,
        activityId: item.activity_id,
        user: {
          id: profile.id,
          name: profile.name,
          gender: profile.gender,
          avatarUrl: profile.avatar_url,
          isVerified: profile.is_verified,
          trustScore: profile.trust_score,
          interactionCount: profile.interaction_count,
        },
        message: item.message ?? '',
        status: item.status,
        createdAt: item.created_at,
      });

      if (!parsed.success) {
        console.warn(
          `fetchIncomingJoinRequests skipped request ${item.id}: payload failed contract validation:`,
          parsed.error.flatten()
        );
        continue;
      }

      requests.push(parsed.data);
    }

    return requests;
  } catch (err) {
    console.warn('fetchIncomingJoinRequests query error:', err);
    return [];
  }
}

/**
 * Executes atomic handshake transaction to accept a joiner.
 * Uses row-level locking (SELECT ... FOR UPDATE) on the activities table.
 */
export async function acceptJoinRequestTx(
  requestId: string,
  hostId: string
): Promise<{ success: boolean; error?: string; data?: AcceptJoinRequestResult }> {
  try {
    const { data, error } = await supabase.rpc('accept_join_request_tx', {
      p_request_id: requestId,
      p_host_id: hostId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const parsed = AcceptJoinRequestResultSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: 'Accept operation returned an unexpected payload' };
    }

    return { success: true, data: parsed.data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to accept join request',
    };
  }
}

/**
 * Host declines a join request.
 */
export async function declineJoinRequest(
  requestId: string,
  hostId: string
): Promise<{ success: boolean; error?: string; data?: DeclineJoinRequestResult }> {
  try {
    const { data, error } = await supabase.rpc('decline_join_request', {
      p_request_id: requestId,
      p_host_id: hostId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const parsed = DeclineJoinRequestResultSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: 'Decline operation returned an unexpected payload' };
    }

    return { success: true, data: parsed.data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to decline request',
    };
  }
}

/**
 * Leaves an activity/squad.
 * Uses atomic SECURITY DEFINER RPC with row-level locking.
 */
export async function leaveSquad(
  activityId: string,
  userId: string
): Promise<{ success: boolean; error?: string; data?: LeaveActivityResult }> {
  try {
    const { data, error } = await supabase.rpc('leave_activity', {
      p_activity_id: activityId,
      p_user_id: userId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const parsed = LeaveActivityResultSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: 'Leave operation returned an unexpected payload' };
    }

    return { success: true, data: parsed.data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to leave squad',
    };
  }
}

/**
 * Realtime subscription for a Joiner waiting on their request status.
 */
export function subscribeToJoinRequestUpdates(
  requestId: string,
  onStatusChange: (status: 'accepted' | 'declined' | 'pending' | 'cancelled') => void
): () => void {
  return subscribeToPostgresChanges(
    `join_request_${requestId}`,
    { event: 'UPDATE', schema: 'public', table: 'join_requests', filter: `id=eq.${requestId}` },
    (payload) => {
      const parsed = parseJoinRequestPayload(payload);
      if (parsed) onStatusChange(parsed.status);
    },
    (message) => console.warn('Join request Realtime error:', message),
  );
}

/**
 * Realtime subscription for a Host monitoring incoming squad requests.
 */
export function subscribeToHostQueue(
  activityId: string,
  onQueueChanged: () => void
): () => void {
  return subscribeToPostgresChanges(
    `host_queue_${activityId}`,
    { event: '*', schema: 'public', table: 'join_requests', filter: `activity_id=eq.${activityId}` },
    onQueueChanged,
    (message) => console.warn('Host queue Realtime error:', message),
  );
}

function parseJoinRequestPayload(
  value: unknown
): { id: string; status: 'accepted' | 'declined' | 'pending' | 'cancelled' } | null {
  if (!value || typeof value !== 'object' || !('new' in value)) return null;
  const parsed = JoinRequestRealtimeRowSchema.safeParse((value as { new: unknown }).new);
  return parsed.success ? parsed.data : null;
}
