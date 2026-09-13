import { supabase } from './supabase';
import { Database } from '@hobbie/shared';
import { subscribeToPostgresChanges } from './realtimePool';

export type JoinRequestRow = Database['public']['Tables']['join_requests']['Row'];
export type ActivityRow = Database['public']['Tables']['activities']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export interface IncomingJoinRequest {
  id: string;
  activityId: string;
  userId: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
  user: {
    id: string;
    name: string;
    trustScore: number;
    isVerified: boolean;
    avatarUrl: string | null;
  };
}

/**
 * Creates a pending join request for an activity.
 * Uses the atomic SECURITY DEFINER RPC. Direct inserts are intentionally not
 * used because they would bypass the activity-state and capacity invariants.
 */
export async function requestToJoin(
  activityId: string,
  userId: string,
  message: string = ''
): Promise<{ data?: JoinRequestRow; error?: string }> {
  try {
    // 1. Try atomic SECURITY DEFINER RPC first (production standard)
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'request_to_join_activity',
      {
        p_activity_id: activityId,
        p_user_id: userId,
        p_message: message.trim(),
      }
    );

    if (!rpcError && rpcData) {
      return { data: rpcData as unknown as JoinRequestRow };
    }
    return {
      error: rpcError?.message || 'Atomic join-request operation is unavailable',
    };
  } catch (err: any) {
    return { error: err?.message || 'Failed to submit join request' };
  }
}

/**
 * Fetches user's join request status for a given activity.
 */
export async function getJoinRequestStatus(
  activityId: string,
  userId: string
): Promise<JoinRequestRow | null> {
  try {
    const { data, error } = await supabase
      .from('join_requests')
      .select('*')
      .eq('activity_id', activityId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Counts pending join requests for an activity.
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
 * Fetches incoming join requests for an activity hosted by the current user.
 */
export async function fetchIncomingJoinRequests(
  activityId: string
): Promise<IncomingJoinRequest[]> {
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
          avatar_url
        )
      `)
      .eq('activity_id', activityId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map((item: any) => ({
      id: item.id,
      activityId: item.activity_id,
      userId: item.user_id,
      message: item.message || '',
      status: item.status,
      createdAt: item.created_at,
      user: {
        id: item.profiles?.id || item.user_id,
        name: item.profiles?.name || 'Fellow Hobbie Player',
        trustScore: item.profiles?.trust_score ?? 5.0,
        isVerified: item.profiles?.is_verified ?? false,
        avatarUrl: item.profiles?.avatar_url ?? null,
      },
    }));
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
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const { data, error } = await supabase.rpc('accept_join_request_tx', {
      p_request_id: requestId,
      p_host_id: hostId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to accept join request' };
  }
}

/**
 * Host declines a join request.
 */
export async function declineJoinRequest(
  requestId: string,
  hostId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('decline_join_request', {
      p_request_id: requestId,
      p_host_id: hostId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to decline request' };
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
      if (isJoinRequestPayload(payload)) onStatusChange(payload.new.status);
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

function isJoinRequestPayload(value: unknown): value is { new: JoinRequestRow } {
  if (!value || typeof value !== 'object' || !('new' in value)) return false;
  const row = value.new;
  return !!row && typeof row === 'object' && 'id' in row && 'status' in row;
}
