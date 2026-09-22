import { z } from 'zod';
import { ActivityStatusSchema, CoordinatesSchema } from './activity.schema.js';
import { JoinRequestStatusSchema } from './join-request.schema.js';
import { UserGenderSchema } from './user.schema.js';

export const SendMessageSchema = z.object({
  activityId: z.string().uuid(),
  content: z.string().min(1).max(500),
});

/**
 * Raw `room_messages` row contract for the columns the room client selects and
 * receives over Realtime. Parsed before mapping into the `ChatMessage` DTO.
 */
export const RoomMessageRowSchema = z.object({
  id: z.string().uuid(),
  activity_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  content: z.string(),
  created_at: z.string(),
});

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  activityId: z.string().uuid(),
  senderId: z.string().uuid(),
  senderName: z.string(),
  content: z.string(),
  createdAt: z.string().datetime({ offset: true }),
  isHost: z.boolean().default(false),
});

/**
 * Raw row contract of the `get_activity_members` roster RPC. Carries the full
 * `UserSummarySchema` field set so the client never has to invent defaults.
 */
export const ActivityMemberRowSchema = z.object({
  user_id: z.string().uuid(),
  name: z.string(),
  avatar_url: z.string().nullable(),
  is_host: z.boolean(),
  trust_score: z.number(),
  gender: UserGenderSchema,
  is_verified: z.boolean(),
  interaction_count: z.number().int().nonnegative(),
});

export const ActivityLocationResultSchema = CoordinatesSchema;

/** Raw JSONB contract of `conclude_activity_tx`. */
export const ConcludeActivityResultSchema = z.object({
  success: z.literal(true),
  activity_id: z.string().uuid(),
  status: ActivityStatusSchema,
});

/** Raw row contract of `get_pending_request_counts`. */
export const PendingRequestCountRowSchema = z.object({
  activity_id: z.string().uuid(),
  pending_count: z.number().int().nonnegative(),
});

/** Realtime DELETE/UPDATE payload for a single join request status change. */
export const JoinRequestRealtimeRowSchema = z.object({
  id: z.string().uuid(),
  status: JoinRequestStatusSchema,
});

export const RoomMessageRowsSchema = z.array(RoomMessageRowSchema);
export const ActivityMemberRowsSchema = z.array(ActivityMemberRowSchema);
export const PendingRequestCountRowsSchema = z.array(PendingRequestCountRowSchema);

export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type RoomMessageRow = z.infer<typeof RoomMessageRowSchema>;
export type ActivityMemberRow = z.infer<typeof ActivityMemberRowSchema>;
export type ActivityLocationResult = z.infer<typeof ActivityLocationResultSchema>;
export type ConcludeActivityResult = z.infer<typeof ConcludeActivityResultSchema>;
export type PendingRequestCountRow = z.infer<typeof PendingRequestCountRowSchema>;
