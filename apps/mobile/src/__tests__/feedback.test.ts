import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubmitFeedbackSchema } from '@hobbie/shared';
import {
  calculateFeedbackScore,
  submitActivityFeedback,
  checkHasReviewedActivity,
} from '../services/feedback';
import { supabase } from '../services/supabase';

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));

describe('Feedback Domain & Service', () => {
  const validActivityId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const validTargetUserId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  const validReviewerId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateFeedbackScore', () => {
    it('returns 5 stars when both positive (again=true, asDescribed=true)', () => {
      expect(calculateFeedbackScore(true, true)).toBe(5);
    });

    it('returns 3 stars when mixed (again=false, asDescribed=true)', () => {
      expect(calculateFeedbackScore(false, true)).toBe(3);
    });

    it('returns 3 stars when mixed (again=true, asDescribed=false)', () => {
      expect(calculateFeedbackScore(true, false)).toBe(3);
    });

    it('returns 1 star when both negative (again=false, asDescribed=false)', () => {
      expect(calculateFeedbackScore(false, false)).toBe(1);
    });
  });

  describe('SubmitFeedbackSchema Validation', () => {
    it('accepts valid feedback payload', () => {
      const payload = {
        activityId: validActivityId,
        targetUserId: validTargetUserId,
        score: 5,
        tags: ['Friendly', 'On Time'],
        keepInTouch: true,
      };
      const parsed = SubmitFeedbackSchema.parse(payload);
      expect(parsed.score).toBe(5);
      expect(parsed.keepInTouch).toBe(true);
      expect(parsed.tags).toHaveLength(2);
    });

    it('rejects scores below 1 or above 5', () => {
      expect(() =>
        SubmitFeedbackSchema.parse({
          activityId: validActivityId,
          targetUserId: validTargetUserId,
          score: 0,
        })
      ).toThrow();

      expect(() =>
        SubmitFeedbackSchema.parse({
          activityId: validActivityId,
          targetUserId: validTargetUserId,
          score: 6,
        })
      ).toThrow();
    });

    it('rejects non-UUID strings for activityId or targetUserId', () => {
      expect(() =>
        SubmitFeedbackSchema.parse({
          activityId: 'invalid-id',
          targetUserId: validTargetUserId,
          score: 4,
        })
      ).toThrow();
    });
  });

  describe('submitActivityFeedback Service', () => {
    it('throws error if user is unauthenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as any);

      await expect(
        submitActivityFeedback({
          activityId: validActivityId,
          targetUserId: validTargetUserId,
          score: 5,
          tags: ['Friendly'],
          keepInTouch: true,
        })
      ).rejects.toThrow('You must be signed in to submit feedback');
    });

    it('calls submit_activity_feedback_tx with correct parameters and returns result', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: validReviewerId } },
        error: null,
      } as any);

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: {
          success: true,
          activity_id: validActivityId,
          reviewer_id: validReviewerId,
          target_user_id: validTargetUserId,
          score: 5,
          mutual_connection: true,
        },
        error: null,
      } as any);

      const result = await submitActivityFeedback({
        activityId: validActivityId,
        targetUserId: validTargetUserId,
        score: 5,
        tags: ['Friendly', 'On Time'],
        keepInTouch: true,
      });

      expect(supabase.rpc).toHaveBeenCalledWith('submit_activity_feedback_tx', {
        p_activity_id: validActivityId,
        p_reviewer_id: validReviewerId,
        p_target_user_id: validTargetUserId,
        p_score: 5,
        p_tags: ['Friendly', 'On Time'],
        p_keep_in_touch: true,
      });

      expect(result.success).toBe(true);
      expect(result.mutualConnection).toBe(true);
      expect(result.score).toBe(5);
    });

    it('throws when RPC returns an error', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: validReviewerId } },
        error: null,
      } as any);

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Database failure' },
      } as any);

      await expect(
        submitActivityFeedback({
          activityId: validActivityId,
          targetUserId: validTargetUserId,
          score: 3,
        })
      ).rejects.toThrow('Database failure');
    });
  });

  describe('checkHasReviewedActivity Service', () => {
    it('returns true when user has reviewed activity', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null,
      } as any);

      const reviewed = await checkHasReviewedActivity(validActivityId, validReviewerId);
      expect(reviewed).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('has_reviewed_activity', {
        p_activity_id: validActivityId,
        p_user_id: validReviewerId,
      });
    });

    it('returns false when IDs are missing', async () => {
      const reviewed = await checkHasReviewedActivity('', '');
      expect(reviewed).toBe(false);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });
});
