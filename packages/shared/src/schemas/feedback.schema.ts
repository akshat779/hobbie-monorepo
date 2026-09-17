import { z } from 'zod';

export const SubmitFeedbackSchema = z.object({
  activityId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  score: z.number().min(1).max(5),
  tags: z.array(z.string()).optional().default([]),
  keepInTouch: z.boolean().default(false),
});

export const ReportUserSchema = z.object({
  targetUserId: z.string().uuid(),
  activityId: z.string().uuid().optional(),
  reason: z.enum([
    'harassment',
    'catfishing',
    'no_show',
    'unsafe_behavior',
    'spam',
    'other',
  ]),
  notes: z.string().max(500).optional(),
});

/** Raw JSONB contract of `submit_activity_feedback_tx`. */
export const SubmitFeedbackResultSchema = z.object({
  success: z.literal(true),
  activity_id: z.string().uuid(),
  reviewer_id: z.string().uuid(),
  target_user_id: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  mutual_connection: z.boolean(),
});

export type SubmitFeedbackInput = z.input<typeof SubmitFeedbackSchema>;
export type SubmitFeedbackOutput = z.output<typeof SubmitFeedbackSchema>;
export type ReportUserInput = z.infer<typeof ReportUserSchema>;
export type SubmitFeedbackResult = z.infer<typeof SubmitFeedbackResultSchema>;
