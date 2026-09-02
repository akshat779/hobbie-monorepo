import { z } from 'zod';
import { UserSummarySchema } from './user.schema.js';

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
  status: z.enum(['pending', 'accepted', 'declined', 'cancelled']),
  createdAt: z.string().datetime(),
});

export type RequestToJoinInput = z.infer<typeof RequestToJoinSchema>;
export type RespondJoinRequestInput = z.infer<typeof RespondJoinRequestSchema>;
export type JoinRequestPublic = z.infer<typeof JoinRequestPublicSchema>;
