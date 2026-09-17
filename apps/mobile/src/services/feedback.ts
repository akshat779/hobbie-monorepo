import { SubmitFeedbackInput, SubmitFeedbackSchema } from '@hobbie/shared';
import { supabase } from './supabase';

export interface SubmitFeedbackResult {
  success: boolean;
  activityId: string;
  reviewerId: string;
  targetUserId: string;
  score: number;
  mutualConnection: boolean;
}

/**
 * Pure deterministic mapping from yes/no answers to 1-5 trust rating score.
 */
export function calculateFeedbackScore(again: boolean, asDescribed: boolean): number {
  if (again && asDescribed) return 5;
  if (!again && !asDescribed) return 1;
  return 3;
}

/**
 * Submits post-activity feedback for a squad member and evaluates dual-opt-in kept connections.
 * Enforces strict validation against shared SubmitFeedbackSchema.
 */
export async function submitActivityFeedback(
  input: SubmitFeedbackInput
): Promise<SubmitFeedbackResult> {
  const validated = SubmitFeedbackSchema.parse(input);

  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData.user?.id;
  if (!currentUserId) {
    throw new Error('You must be signed in to submit feedback');
  }

  const { data, error } = await supabase.rpc('submit_activity_feedback_tx', {
    p_activity_id: validated.activityId,
    p_reviewer_id: currentUserId,
    p_target_user_id: validated.targetUserId,
    p_score: validated.score,
    p_tags: validated.tags || [],
    p_keep_in_touch: validated.keepInTouch ?? false,
  });

  if (error || !data) {
    throw new Error(error?.message || 'Failed to submit feedback');
  }

  const res = data as unknown as {
    success: boolean;
    activity_id: string;
    reviewer_id: string;
    target_user_id: string;
    score: number;
    mutual_connection: boolean;
  };

  return {
    success: res.success,
    activityId: res.activity_id,
    reviewerId: res.reviewer_id,
    targetUserId: res.target_user_id,
    score: res.score,
    mutualConnection: res.mutual_connection,
  };
}

/**
 * Checks whether the current user has already submitted ratings for this activity.
 */
export async function checkHasReviewedActivity(
  activityId: string,
  userId: string
): Promise<boolean> {
  if (!activityId || !userId) return false;

  const { data, error } = await supabase.rpc('has_reviewed_activity', {
    p_activity_id: activityId,
    p_user_id: userId,
  });

  if (error) {
    console.warn('checkHasReviewedActivity RPC warning:', error.message);
    return false;
  }

  return Boolean(data);
}
