import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CreateActivityInput } from '@hobbie/shared';
import { createActivity } from '../../services/activityCreation';
import {
  requestToJoin,
  acceptJoinRequestTx,
  declineJoinRequest,
  JoinRequestRow,
} from '../../services/handshake';
import { queryKeys } from '../../services/queryKeys';

/**
 * Mutation hook for creating a new live squad.
 * Automatically invalidates nearby discovery and the host's squad list.
 */
export function useCreateActivityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      hostId,
      input,
    }: {
      hostId: string;
      input: CreateActivityInput;
    }) => {
      return createActivity(hostId, input);
    },
    onSuccess: (data, { hostId }) => {
      // Invalidate discovery radar queries so the new squad appears immediately
      void queryClient.invalidateQueries({
        queryKey: queryKeys.discovery.all(),
      });
      // Invalidate host's squad list
      void queryClient.invalidateQueries({
        queryKey: queryKeys.activities.mySquads(hostId),
      });
    },
  });
}

/**
 * Mutation hook for sending a request to join a squad.
 * Updates join status cache and invalidates activity detail.
 */
export function useJoinRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      activityId,
      userId,
      message,
    }: {
      activityId: string;
      userId: string;
      message?: string;
    }): Promise<{ data?: JoinRequestRow; error?: string }> => {
      return requestToJoin(activityId, userId, message);
    },
    onSuccess: (result, { activityId, userId }) => {
      if (result.data) {
        // Cache the updated request directly
        queryClient.setQueryData(
          queryKeys.activities.joinStatus(activityId, userId),
          result.data
        );
      }
      // Invalidate activity details & join status for fresh consistency
      void queryClient.invalidateQueries({
        queryKey: queryKeys.activities.joinStatus(activityId, userId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.activities.detail(activityId),
      });
    },
  });
}

/**
 * Mutation hook for accepting or declining join requests as host.
 */
export function useReviewRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      requestId,
      hostId,
      activityId,
    }: {
      action: 'accept' | 'decline';
      requestId: string;
      hostId: string;
      activityId: string;
    }) => {
      if (action === 'accept') {
        const res = await acceptJoinRequestTx(requestId, hostId);
        if (!res.success) throw new Error(res.error || 'Failed to accept request');
        return res;
      } else {
        const res = await declineJoinRequest(requestId, hostId);
        if (!res.success) throw new Error(res.error || 'Failed to decline request');
        return res;
      }
    },
    onSuccess: (_, { activityId, hostId }) => {
      // Invalidate incoming requests, activity detail, and host's squad list
      void queryClient.invalidateQueries({
        queryKey: queryKeys.activities.hostRequests(activityId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.activities.detail(activityId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.activities.mySquads(hostId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.discovery.all(),
      });
    },
  });
}
