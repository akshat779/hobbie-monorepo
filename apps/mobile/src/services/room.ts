import {
  ActivityLocationResultSchema,
  ActivityMemberRowsSchema,
  ChatMessage,
  ConcludeActivityResultSchema,
  Database,
  RoomMessageRow,
  RoomMessageRowSchema,
  RoomMessageRowsSchema,
  UserSummary,
} from '@hobbie/shared';
import { supabase } from './supabase';
import { subscribeToPostgresChanges } from './realtimePool';

/** Squad roster member: shared user summary plus the room-specific host flag. */
export type RoomMember = UserSummary & {
  isHost: boolean;
};

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
  const { data, error } = await supabase.rpc('conclude_activity_tx', {
    p_activity_id: activityId,
    p_host_id: hostId,
  });
  if (error) {
    throw new Error(error.message || 'Failed to conclude activity');
  }
  const parsed = ConcludeActivityResultSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('Conclude activity operation returned an unexpected payload');
  }
}

export async function fetchActivityExactLocation(activityId: string): Promise<ActivityLocation | null> {
  const { data, error } = await supabase.rpc('get_activity_exact_location', {
    p_activity_id: activityId,
  });
  if (error) {
    throw new Error(error.message || 'Failed to fetch venue location');
  }
  if (!data) {
    return null;
  }
  const parsed = ActivityLocationResultSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('Exact venue location returned an unexpected payload');
  }
  return parsed.data;
}

export async function fetchRoomMembers(activityId: string): Promise<RoomMember[]> {
  const { data, error } = await supabase.rpc('get_activity_members', {
    p_activity_id: activityId,
  });

  if (error) {
    throw new Error(error.message || 'Failed to fetch squad members');
  }

  const parsed = ActivityMemberRowsSchema.safeParse(data ?? []);
  if (!parsed.success) {
    throw new Error('Squad roster returned an unexpected payload');
  }

  return parsed.data.map((member) => ({
    id: member.user_id,
    name: member.name,
    gender: member.gender,
    avatarUrl: member.avatar_url,
    isVerified: member.is_verified,
    trustScore: member.trust_score,
    interactionCount: member.interaction_count,
    isHost: member.is_host,
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

async function fetchActivityHostId(activityId: string): Promise<string | null> {
  const { data } = await supabase
    .from('activities')
    .select('host_id')
    .eq('id', activityId)
    .maybeSingle();
  return data?.host_id ?? null;
}

export async function fetchRoomMessages(activityId: string): Promise<ChatMessage[]> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error('You must be signed in to access this room');
  await assertMembership(activityId, userId);

  const { data, error } = await supabase
    .from('room_messages')
    .select(messageSelect)
    .eq('activity_id', activityId)
    .order('created_at', { ascending: true });
  if (error) {
    throw new Error(error.message || 'Failed to load room messages');
  }

  const parsed = RoomMessageRowsSchema.safeParse(data ?? []);
  if (!parsed.success) {
    throw new Error('Room messages returned an unexpected payload');
  }
  const rows = parsed.data;

  const senderIds = Array.from(new Set(rows.map((message) => message.sender_id)));
  const { data: profiles } = senderIds.length
    ? await supabase.from('profiles').select('id, name').in('id', senderIds)
    : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.name]));

  const hostId = await fetchActivityHostId(activityId);

  return rows.map((row) => ({
    id: row.id,
    activityId: row.activity_id,
    senderId: row.sender_id,
    senderName: names.get(row.sender_id) ?? 'Hobbie Player',
    content: row.content,
    createdAt: row.created_at,
    isHost: hostId !== null && row.sender_id === hostId,
  }));
}

export async function sendRoomMessage(activityId: string, content: string): Promise<ChatMessage> {
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

  // Always surface a concrete, typed Error so downstream `err instanceof Error`
  // renderers show a clean message instead of a raw PostgREST payload object.
  if (error) {
    throw new Error(error.message || 'Failed to send message');
  }
  if (!data) {
    throw new Error('Failed to send message: the insert returned no row');
  }

  const parsed = RoomMessageRowSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('Sent message returned an unexpected payload');
  }

  const { data: profile } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle();
  const hostId = await fetchActivityHostId(activityId);

  return {
    id: parsed.data.id,
    activityId: parsed.data.activity_id,
    senderId: parsed.data.sender_id,
    senderName: profile?.name ?? 'You',
    content: parsed.data.content,
    createdAt: parsed.data.created_at,
    isHost: hostId !== null && parsed.data.sender_id === hostId,
  };
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
      const parsed = parseRoomMessagePayload(payload);
      if (parsed) onMessage(parsed);
    },
    onError,
  );
}

function parseRoomMessagePayload(value: unknown): RoomMessageRow | null {
  if (!value || typeof value !== 'object' || !('new' in value)) return null;
  const parsed = RoomMessageRowSchema.safeParse((value as { new: unknown }).new);
  return parsed.success ? parsed.data : null;
}
