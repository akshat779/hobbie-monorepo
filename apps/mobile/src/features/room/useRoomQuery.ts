import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChatMessage } from '@hobbie/shared';
import {
  fetchRoomMessages,
  fetchRoomMetadata,
  sendRoomMessage,
  subscribeToRoomMessages,
  concludeActivity,
  fetchActivityExactLocation,
  fetchRoomMembers,
  RoomMetadata,
  RoomMember,
  ActivityLocation,
} from '../../services/room';
import { queryKeys } from '../../services/queryKeys';

/**
 * Query hook for ephemeral room metadata (title, venue, expiry, status).
 */
export function useRoomMetadataQuery(roomId: string | undefined) {
  return useQuery<RoomMetadata | null>({
    queryKey: queryKeys.room.meta(roomId || ''),
    queryFn: () => fetchRoomMetadata(roomId || ''),
    enabled: Boolean(roomId),
    staleTime: 1000 * 30,
  });
}

/**
 * Query hook for exact venue GPS coordinates (visible to accepted members).
 */
export function useActivityExactLocationQuery(roomId: string | undefined) {
  return useQuery<ActivityLocation | null>({
    queryKey: queryKeys.room.exactLocation(roomId || ''),
    queryFn: () => fetchActivityExactLocation(roomId || ''),
    enabled: Boolean(roomId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Query hook for squad members in the room.
 */
export function useRoomMembersQuery(roomId: string | undefined) {
  return useQuery<RoomMember[]>({
    queryKey: queryKeys.room.members(roomId || ''),
    queryFn: () => fetchRoomMembers(roomId || ''),
    enabled: Boolean(roomId),
    staleTime: 1000 * 60,
  });
}

/**
 * Mutation hook for host to conclude an activity.
 */
export function useConcludeActivityMutation(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ hostId }: { hostId: string }) => {
      return concludeActivity(roomId, hostId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.room.meta(roomId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.room.messages(roomId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activities.all() });
    },
  });
}

/**
 * Query hook for ephemeral room chat messages.
 */
export function useRoomMessagesQuery(roomId: string | undefined) {
  return useQuery<ChatMessage[]>({
    queryKey: queryKeys.room.messages(roomId || ''),
    queryFn: () => fetchRoomMessages(roomId || ''),
    enabled: Boolean(roomId),
    staleTime: 1000 * 15,
  });
}

/**
 * Mutation hook for sending ephemeral room messages with optimistic UI updates.
 * Adheres strictly to mut-optimistic-updates and mut-rollback-context rules.
 */
export function useSendRoomMessageMutation(roomId: string) {
  const queryClient = useQueryClient();
  const messagesKey = queryKeys.room.messages(roomId);

  return useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      return sendRoomMessage(roomId, content);
    },
    onMutate: async ({ content }) => {
      // 1. Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: messagesKey });

      // 2. Snapshot the previous messages for rollback context
      const previousMessages =
        queryClient.getQueryData<ChatMessage[]>(messagesKey) ?? [];

      // 3. Optimistically append new message
      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        activityId: roomId,
        senderId: 'current-user',
        senderName: 'You',
        content,
        createdAt: new Date().toISOString(),
        isHost: false,
      };

      queryClient.setQueryData<ChatMessage[]>(messagesKey, (old) => [
        ...(old ?? []),
        optimisticMessage,
      ]);

      return { previousMessages };
    },
    onError: (_err, _variables, context) => {
      // Rollback to snapshot on error
      if (context?.previousMessages) {
        queryClient.setQueryData(messagesKey, context.previousMessages);
      }
    },
    onSettled: () => {
      // Re-sync with server after settled
      void queryClient.invalidateQueries({ queryKey: messagesKey });
    },
  });
}

/**
 * Helper to register Realtime listener that directly mutates TanStack Query cache.
 */
export function setupRealtimeRoomSync(
  roomId: string,
  currentUserId: string | undefined,
  queryClient: ReturnType<typeof useQueryClient>,
  onError?: (msg: string) => void
): () => void {
  const messagesKey = queryKeys.room.messages(roomId);

  return subscribeToRoomMessages(
    roomId,
    (incoming) => {
      queryClient.setQueryData<ChatMessage[]>(messagesKey, (old = []) => {
        // If message already exists (or matched by ID), skip duplicate
        if (old.some((m) => m.id === incoming.id)) {
          return old;
        }

        // If it was an optimistic message from current user, replace it or append incoming
        const isFromMe = incoming.sender_id === currentUserId;
        const filtered = isFromMe
          ? old.filter((m) => !m.id.startsWith('temp-') || m.content !== incoming.content)
          : old;

        return [
          ...filtered,
          {
            id: incoming.id,
            activityId: incoming.activity_id,
            senderId: incoming.sender_id,
            senderName: isFromMe ? 'You' : 'Hobbie Player',
            content: incoming.content,
            createdAt: incoming.created_at,
            isHost: false,
          },
        ];
      });
    },
    onError
  );
}
