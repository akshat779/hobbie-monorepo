import { Database } from '@hobbie/shared';
import { supabase } from './supabase';
import { subscribeToPostgresChanges } from './realtimePool';

export type RoomMessageRow = Database['public']['Tables']['room_messages']['Row'];

export interface RoomMessage extends RoomMessageRow {
  senderName: string;
}

export interface RoomMetadata {
  id: string;
  title: string;
  venueName: string | null;
  expiresAt: string;
  status: Database['public']['Enums']['activity_status'];
  hostId: string;
  interestId: string;
}

export interface ActivityLocation {
  latitude: number;
  longitude: number;
}

export interface RoomMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  isHost: boolean;
  trustScore: number;
}

export async function fetchRoomMetadata(activityId: string): Promise<RoomMetadata | null> {
  const { data, error } = await supabase
    .from('activities')
    .select('id, title, venue_name, expires_at, status, host_id, interest_id')
    .eq('id', activityId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    title: data.title,
    venueName: data.venue_name,
    expiresAt: data.expires_at,
    status: data.status,
    hostId: data.host_id,
    interestId: data.interest_id,
  };
}

export async function concludeActivity(activityId: string, hostId: string): Promise<void> {
  const { error } = await supabase.rpc('conclude_activity_tx', {
    p_activity_id: activityId,
    p_host_id: hostId,
  });
  if (error) {
    throw new Error(error.message || 'Failed to conclude activity');
  }
}

export async function fetchActivityExactLocation(activityId: string): Promise<ActivityLocation | null> {
  const { data, error } = await supabase.rpc('get_activity_exact_location', {
    p_activity_id: activityId,
  });
  if (error || !data) {
    throw new Error(error?.message || 'Failed to fetch venue location');
  }
  const loc = data as unknown as { latitude: number; longitude: number };
  return {
    latitude: loc.latitude,
    longitude: loc.longitude,
  };
}

export async function fetchRoomMembers(activityId: string): Promise<RoomMember[]> {
  const { data, error } = await supabase.rpc('get_activity_members', {
    p_activity_id: activityId,
  });

  if (error) {
    throw new Error(error.message || 'Failed to fetch squad members');
  }

  return (data || []).map((m) => ({
    userId: m.user_id,
    name: m.name,
    avatarUrl: m.avatar_url,
    isHost: m.is_host,
    trustScore: m.trust_score,
  }));
}

const messageSelect = 'id, activity_id, sender_id, content, created_at';

async function assertMembership(activityId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('activity_members')
    .select('id')
    .eq('activity_id', activityId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('You must be an accepted squad member to access this room');
  }
}

export async function fetchRoomMessages(activityId: string): Promise<RoomMessage[]> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error('You must be signed in to access this room');
  await assertMembership(activityId, userId);

  const { data, error } = await supabase
    .from('room_messages')
    .select(messageSelect)
    .eq('activity_id', activityId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const senderIds = Array.from(new Set((data ?? []).map((message) => message.sender_id)));
  const { data: profiles } = senderIds.length
    ? await supabase.from('profiles').select('id, name').in('id', senderIds)
    : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.name]));

  return (data ?? []).map((message) => ({
    ...message,
    senderName: names.get(message.sender_id) ?? 'Hobbie Player',
  }));
}

export async function sendRoomMessage(activityId: string, content: string): Promise<RoomMessage> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Message cannot be empty');
  if (trimmed.length > 500) throw new Error('Message cannot exceed 500 characters');

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error('You must be signed in to send messages');
  await assertMembership(activityId, userId);

  const { data, error } = await supabase
    .from('room_messages')
    .insert({ activity_id: activityId, sender_id: userId, content: trimmed })
    .select(messageSelect)
    .single();
  if (error || !data) throw error ?? new Error('Failed to send message');

  const { data: profile } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle();
  return { ...data, senderName: profile?.name ?? 'You' };
}

export function subscribeToRoomMessages(
  activityId: string,
  onMessage: (message: RoomMessageRow) => void,
  onError?: (message: string) => void,
): () => void {
  return subscribeToPostgresChanges(
    `room_messages_${activityId}`,
    { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `activity_id=eq.${activityId}` },
    (payload) => {
      if (isRoomMessagePayload(payload)) onMessage(payload.new);
    },
    onError,
  );
}

function isRoomMessagePayload(value: unknown): value is { new: RoomMessageRow } {
  if (!value || typeof value !== 'object' || !('new' in value)) return false;
  const message = value.new;
  return !!message && typeof message === 'object'
    && 'id' in message && 'activity_id' in message && 'sender_id' in message
    && 'content' in message && 'created_at' in message;
}
