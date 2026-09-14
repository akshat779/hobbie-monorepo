import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { CreateActivityInput } from '@hobbie/shared';
import { createActivity } from '../../services/activityCreation';
import {
  requestToJoin,
  acceptJoinRequestTx,
  declineJoinRequest,
  JoinRequestRow,
  IncomingJoinRequest,
} from '../../services/handshake';
import { ActivityDetails } from '../../services/activityDetail';
import { MySquadItem } from './useMyActivitiesQuery';
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
 * Mutation options for sending a request to join a squad with optimistic UI updates.
 * Updates join status cache immediately and rolls back if rejected.
 */
export function getJoinRequestMutationOptions(queryClient: QueryClient) {
  return {
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
    onMutate: async ({
      activityId,
      userId,
      message,
    }: {
      activityId: string;
      userId: string;
      message?: string;
    }) => {
      const joinStatusKey = queryKeys.activities.joinStatus(activityId, userId);

      // 1. Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: joinStatusKey });

      // 2. Snapshot previous value
      const previousStatus = queryClient.getQueryData<JoinRequestRow | null>(joinStatusKey);

      // 3. Optimistically set to pending
      const optimisticRequest: JoinRequestRow = {
        id: `temp-${Date.now()}`,
        activity_id: activityId,
        user_id: userId,
        message: message || '',
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<JoinRequestRow | null>(joinStatusKey, optimisticRequest);

      return { previousStatus, activityId, userId };
    },
    onError: (
      _err: unknown,
      _vars: unknown,
      context: { previousStatus?: JoinRequestRow | null; activityId: string; userId: string } | undefined
    ) => {
      if (!context) return;
      queryClient.setQueryData(
        queryKeys.activities.joinStatus(context.activityId, context.userId),
        context.previousStatus
      );
    },
    onSuccess: (
      result: { data?: JoinRequestRow; error?: string },
      { activityId, userId }: { activityId: string; userId: string }
    ) => {
      if (result.data) {
        queryClient.setQueryData(
          queryKeys.activities.joinStatus(activityId, userId),
          result.data
        );
      }
    },
    onSettled: (
      _data: unknown,
      _err: unknown,
      { activityId, userId }: { activityId: string; userId: string }
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
 * Mutation options for accepting or declining join requests as host with optimistic UI updates.
 * Adheres strictly to mut-optimistic-updates and mut-rollback-context rules.
 */
export function getReviewRequestMutationOptions(queryClient: QueryClient) {
  return {
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
    onMutate: async ({
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
      const hostRequestsKey = queryKeys.activities.hostRequests(activityId);
      const detailKey = queryKeys.activities.detail(activityId);
      const mySquadsKey = queryKeys.activities.mySquads(hostId);

      // 1. Cancel outgoing queries
      await Promise.all([
        queryClient.cancelQueries({ queryKey: hostRequestsKey }),
        queryClient.cancelQueries({ queryKey: detailKey }),
        queryClient.cancelQueries({ queryKey: mySquadsKey }),
      ]);

      // 2. Snapshot previous states for rollback context
      const previousRequests = queryClient.getQueryData<IncomingJoinRequest[]>(hostRequestsKey);
      const previousDetail = queryClient.getQueryData<ActivityDetails | null>(detailKey);
      const previousMySquads = queryClient.getQueryData<MySquadItem[]>(mySquadsKey);

      // 3. Optimistically remove the request from the host review list
      queryClient.setQueryData(
        hostRequestsKey,
        (old: IncomingJoinRequest[] | undefined) => (old ?? []).filter((r) => r.id !== requestId)
      );

      // 4. If accepted, optimistically increment participant count
      if (action === 'accept') {
        queryClient.setQueryData(
          detailKey,
          (old: ActivityDetails | null | undefined) => {
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

      return { previousRequests, previousDetail, previousMySquads, activityId, hostId };
    },
    onError: (
      _err: unknown,
      _vars: unknown,
      context:
        | {
            previousRequests?: IncomingJoinRequest[];
            previousDetail?: ActivityDetails | null;
            previousMySquads?: MySquadItem[];
            activityId: string;
            hostId: string;
          }
        | undefined
    ) => {
      if (!context) return;
      const hostRequestsKey = queryKeys.activities.hostRequests(context.activityId);
      const detailKey = queryKeys.activities.detail(context.activityId);
      const mySquadsKey = queryKeys.activities.mySquads(context.hostId);

      if (context.previousRequests) {
        queryClient.setQueryData(hostRequestsKey, context.previousRequests);
      }
      if (context.previousDetail) {
        queryClient.setQueryData(detailKey, context.previousDetail);
      }
      if (context.previousMySquads) {
        queryClient.setQueryData(mySquadsKey, context.previousMySquads);
      }
    },
    onSettled: (
      _data: unknown,
      _error: unknown,
      { activityId, hostId }: { activityId: string; hostId: string }
    ) => {
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
  };
}

export function useReviewRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation(getReviewRequestMutationOptions(queryClient));
}


