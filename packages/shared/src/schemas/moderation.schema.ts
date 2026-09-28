import { z } from 'zod';

/** Canonical report reasons, mirrored from the `report_reason` Postgres enum. */
export const REPORT_REASONS = [
  'harassment',
  'catfishing',
  'no_show',
  'unsafe_behavior',
  'spam',
  'other',
] as const;
export const ReportReasonSchema = z.enum(REPORT_REASONS);

export const BlockUserSchema = z.object({
  targetUserId: z.string().uuid(),
});

/** Raw JSONB contract of `block_user` / `unblock_user`. */
export const BlockActionResultSchema = z.object({
  success: z.literal(true),
  blocked_id: z.string().uuid(),
});

export type ReportReason = z.infer<typeof ReportReasonSchema>;
export type BlockUserInput = z.infer<typeof BlockUserSchema>;
export type BlockActionResult = z.infer<typeof BlockActionResultSchema>;
