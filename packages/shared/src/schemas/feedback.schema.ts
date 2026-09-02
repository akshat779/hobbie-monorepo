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

export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackSchema>;
export type ReportUserInput = z.infer<typeof ReportUserSchema>;
