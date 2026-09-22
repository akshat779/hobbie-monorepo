import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SubmitFeedbackInput } from '@hobbie/shared';
import { submitActivityFeedback, checkHasReviewedActivity, SubmitFeedbackResult } from '../../services/feedback';
import { queryKeys } from '../../services/queryKeys';

/**
 * Mutation hook for submitting feedback on squad members.
 */
export function useSubmitFeedbackMutation(activityId: string, currentUserId: string) {
  const queryClient = useQueryClient();

  return useMutation<SubmitFeedbackResult, Error, SubmitFeedbackInput>({
    mutationFn: async (input: SubmitFeedbackInput) => {
      return submitActivityFeedback(input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.feedback.hasReviewed(activityId, currentUserId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.activities.mySquads(currentUserId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.room.meta(activityId),
      });
    },
  });
}

/**
 * Query hook to check if user has already reviewed an activity.
 */
export function useHasReviewedQuery(activityId: string | undefined, userId: string | undefined) {
  return useQuery<boolean>({
    queryKey: queryKeys.feedback.hasReviewed(activityId || '', userId || ''),
    queryFn: () => checkHasReviewedActivity(activityId || '', userId || ''),
    enabled: Boolean(activityId && userId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
