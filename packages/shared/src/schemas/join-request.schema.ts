import { z } from 'zod';
import { ActivityStatusSchema } from './activity.schema.js';
import { UserSummarySchema } from './user.schema.js';

export const JOIN_REQUEST_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'cancelled',
] as const;
export const JoinRequestStatusSchema = z.enum(JOIN_REQUEST_STATUSES);

export const RequestToJoinSchema = z.object({
  activityId: z.string().uuid(),
  message: z.string().max(150).optional().default(''),
});

export const RespondJoinRequestSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['accept', 'decline']),
});

export const JoinRequestPublicSchema = z.object({
  id: z.string().uuid(),
  activityId: z.string().uuid(),
  user: UserSummarySchema,
  message: z.string(),
  status: JoinRequestStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
});

/**
 * Raw JSONB contract of `request_to_join_activity`. Mirrors the exact keys the
 * SECURITY DEFINER function emits — never the full `join_requests` table row.
 */
export const RequestToJoinResultSchema = z.object({
  id: z.string().uuid(),
  activity_id: z.string().uuid(),
  user_id: z.string().uuid(),
  message: z
    .string()
    .nullable()
    .transform((value) => value ?? ''),
  status: JoinRequestStatusSchema,
  created_at: z.string(),
});

/** Raw JSONB contract of `accept_join_request_tx`. */
export const AcceptJoinRequestResultSchema = z.object({
  success: z.literal(true),
  activity_id: z.string().uuid(),
  request_id: z.string().uuid(),
  user_id: z.string().uuid(),
  current_participants_count: z.number().int().nonnegative(),
  status: ActivityStatusSchema,
});

/** Raw JSONB contract of `decline_join_request`. */
export const DeclineJoinRequestResultSchema = z.object({
  success: z.literal(true),
  activity_id: z.string().uuid(),
  request_id: z.string().uuid(),
  status: JoinRequestStatusSchema,
});

/**
 * Raw JSONB contract of `leave_activity`. `new_host_id` is null only when the
 * departing member was the last participant and the activity was cancelled.
 */
export const LeaveActivityResultSchema = z.object({
  success: z.literal(true),
  activity_id: z.string().uuid(),
  user_id: z.string().uuid(),
  new_host_id: z.string().uuid().nullable(),
  current_participants_count: z.number().int().nonnegative(),
  status: ActivityStatusSchema,
});

export type RequestToJoinInput = z.infer<typeof RequestToJoinSchema>;
export type RespondJoinRequestInput = z.infer<typeof RespondJoinRequestSchema>;
export type JoinRequestPublic = z.infer<typeof JoinRequestPublicSchema>;
export type RequestToJoinResult = z.infer<typeof RequestToJoinResultSchema>;
export type AcceptJoinRequestResult = z.infer<typeof AcceptJoinRequestResultSchema>;
export type DeclineJoinRequestResult = z.infer<typeof DeclineJoinRequestResultSchema>;
export type LeaveActivityResult = z.infer<typeof LeaveActivityResultSchema>;
