import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ActivityPublic, CreateActivityInput, RequestToJoinResult } from '@hobbie/shared';
import { createActivity } from '../../services/activityCreation';
import {
  requestToJoin,
  acceptJoinRequestTx,
  declineJoinRequest,
} from '../../services/handshake';
import { MySquadItem } from './useMyActivitiesQuery';
import { queryKeys } from '../../services/queryKeys';

interface JoinRequestVariables {
  activityId: string;
  userId: string;
  message?: string;
}

interface JoinRequestContext {
  previousStatus: RequestToJoinResult | null | undefined;
  hadStatusSnapshot: boolean;
  activityId: string;
  userId: string;
}

interface ReviewRequestVariables {
  action: 'accept' | 'decline';
  requestId: string;
  hostId: string;
  activityId: string;
}

interface ReviewRequestContext {
  previousDetail: ActivityPublic | null | undefined;
  hadDetailSnapshot: boolean;
  previousMySquads: MySquadItem[] | undefined;
  hadMySquadsSnapshot: boolean;
  activityId: string;
  hostId: string;
}

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
 * Mutation options for sending a request to join a squad with optimistic UI updates.
 *
 * `requestToJoin` throws on failure, so TanStack Query routes the failure through
 * `onError` and the captured snapshot is restored.
 */
export function getJoinRequestMutationOptions(queryClient: QueryClient) {
  return {
    mutationFn: async ({
      activityId,
      userId,
      message,
    }: JoinRequestVariables): Promise<RequestToJoinResult> => {
      return requestToJoin(activityId, userId, message);
    },
    onMutate: async ({
      activityId,
      userId,
      message,
    }: JoinRequestVariables): Promise<JoinRequestContext> => {
      const joinStatusKey = queryKeys.activities.joinStatus(activityId, userId);

      // 1. Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: joinStatusKey });

      // 2. Snapshot previous value. `null` is a legitimate cached value and must
      //    be restorable, so track presence separately from the value itself.
      const previousStatus = queryClient.getQueryData<RequestToJoinResult | null>(joinStatusKey);
      const hadStatusSnapshot = previousStatus !== undefined;

      // 3. Optimistically set to pending
      const optimisticRequest: RequestToJoinResult = {
        id: `temp-${Date.now()}`,
        activity_id: activityId,
        user_id: userId,
        message: message || '',
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<RequestToJoinResult | null>(joinStatusKey, optimisticRequest);

      return { previousStatus, hadStatusSnapshot, activityId, userId };
    },
    onError: (
      _err: unknown,
      _vars: JoinRequestVariables,
      context: JoinRequestContext | undefined
    ) => {
      if (!context) return;
      if (!context.hadStatusSnapshot) return;
      queryClient.setQueryData(
        queryKeys.activities.joinStatus(context.activityId, context.userId),
        context.previousStatus
      );
    },
    onSuccess: (data: RequestToJoinResult, { activityId, userId }: JoinRequestVariables) => {
      queryClient.setQueryData(
        queryKeys.activities.joinStatus(activityId, userId),
        data
      );
    },
    onSettled: (
      _data: unknown,
      _err: unknown,
      { activityId, userId }: JoinRequestVariables
    ) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.activities.joinStatus(activityId, userId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.activities.detail(activityId),
      });
    },
  };
}

export function useJoinRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation(getJoinRequestMutationOptions(queryClient));
}

/**
 * Mutation options for accepting or declining join requests as host with
 * optimistic UI updates.
 *
 * Note: the host review queue is owned by `HostReviewModal`'s local state and is
 * re-read from the server on settle. There is no `hostRequests` TanStack cache
 * key in play, so no optimistic write is attempted against a key nobody reads.
 */
export function getReviewRequestMutationOptions(queryClient: QueryClient) {
  return {
    mutationFn: async ({
      action,
      requestId,
      hostId,
      activityId,
    }: ReviewRequestVariables) => {
      if (action === 'accept') {
        const res = await acceptJoinRequestTx(requestId, hostId);
        if (!res.success) throw new Error(res.error || 'Failed to accept request');
        return res;
      }

      const res = await declineJoinRequest(requestId, hostId);
      if (!res.success) throw new Error(res.error || 'Failed to decline request');
      return res;
    },
    onMutate: async ({
      action,
      requestId,
      hostId,
      activityId,
    }: ReviewRequestVariables): Promise<ReviewRequestContext> => {
      const detailKey = queryKeys.activities.detail(activityId);
      const mySquadsKey = queryKeys.activities.mySquads(hostId);

      // 1. Cancel outgoing queries
      await Promise.all([
        queryClient.cancelQueries({ queryKey: detailKey }),
        queryClient.cancelQueries({ queryKey: mySquadsKey }),
      ]);

      // 2. Snapshot previous states for rollback context. Presence is tracked
      //    separately so a legitimate `null` detail snapshot can be restored.
      const previousDetail = queryClient.getQueryData<ActivityPublic | null>(detailKey);
      const hadDetailSnapshot = previousDetail !== undefined;
      const previousMySquads = queryClient.getQueryData<MySquadItem[]>(mySquadsKey);
      const hadMySquadsSnapshot = previousMySquads !== undefined;

      // 3. If accepted, optimistically increment participant count
      if (action === 'accept') {
        queryClient.setQueryData(
          detailKey,
          (old: ActivityPublic | null | undefined) => {
            if (!old) return old;
            const newCount = old.currentParticipantsCount + 1;
            return {
              ...old,
              currentParticipantsCount: newCount,
              status: newCount >= old.maxParticipants ? 'full' : old.status,
            };
          }
        );

        queryClient.setQueryData(
          mySquadsKey,
          (old: MySquadItem[] | undefined) =>
            (old ?? []).map((s) => {
              if (s.id !== activityId) return s;
              const newCount = s.currentParticipantsCount + 1;
              return {
                ...s,
                currentParticipantsCount: newCount,
                pendingRequestsCount: Math.max(0, (s.pendingRequestsCount || 1) - 1),
                status: newCount >= s.maxParticipants ? 'full' : s.status,
              };
            })
        );
      } else {
        // Declined: only decrement pending request count in squad item
        queryClient.setQueryData(
          mySquadsKey,
          (old: MySquadItem[] | undefined) =>
            (old ?? []).map((s) => {
              if (s.id !== activityId) return s;
              return {
                ...s,
                pendingRequestsCount: Math.max(0, (s.pendingRequestsCount || 1) - 1),
              };
            })
        );
      }

      return {
        previousDetail,
        hadDetailSnapshot,
        previousMySquads,
        hadMySquadsSnapshot,
        activityId,
        hostId,
      };
    },
    onError: (
      _err: unknown,
      _vars: ReviewRequestVariables,
      context: ReviewRequestContext | undefined
    ) => {
      if (!context) return;

      const detailKey = queryKeys.activities.detail(context.activityId);
      const mySquadsKey = queryKeys.activities.mySquads(context.hostId);

      // Restore every captured snapshot, including legitimate `null` values, so a
      // corrupted optimistic value can never survive a failed mutation.
      if (context.hadDetailSnapshot) {
        queryClient.setQueryData(detailKey, context.previousDetail);
      }
      if (context.hadMySquadsSnapshot) {
        queryClient.setQueryData(mySquadsKey, context.previousMySquads);
      }
    },
    onSettled: (
      _data: unknown,
      _error: unknown,
      { activityId, hostId }: ReviewRequestVariables
    ) => {
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
  };
}

export function useReviewRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation(getReviewRequestMutationOptions(queryClient));
}
