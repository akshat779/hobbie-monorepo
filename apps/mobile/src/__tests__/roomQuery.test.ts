import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryKeys';
import { RoomMessage } from '../services/room';

describe('Ephemeral Room Chat Queries & Optimistic Mutations', () => {
  let queryClient: QueryClient;
  const roomId = 'test-room-123';
  const messagesKey = queryKeys.room.messages(roomId);

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it('generates predictable query keys for room messages and metadata', () => {
    expect(queryKeys.room.messages(roomId)).toEqual(['hobbie', 'room', 'messages', roomId]);
    expect(queryKeys.room.meta(roomId)).toEqual(['hobbie', 'room', 'meta', roomId]);
  });

  it('performs optimistic cache updates before mutation settles', async () => {
    const initialMessages: RoomMessage[] = [
      {
        id: 'msg-1',
        activity_id: roomId,
        sender_id: 'user-other',
        content: 'Hey everyone!',
        created_at: new Date().toISOString(),
        senderName: 'Sam Chen',
      },
    ];

    queryClient.setQueryData(messagesKey, initialMessages);

    // Simulate optimistic onMutate
    const outgoingContent = 'On my way!';
    const previousMessages = queryClient.getQueryData<RoomMessage[]>(messagesKey) ?? [];

    const optimisticMessage: RoomMessage = {
      id: `temp-${Date.now()}`,
      activity_id: roomId,
      sender_id: 'current-user',
      content: outgoingContent,
      created_at: new Date().toISOString(),
      senderName: 'You',
    };

    queryClient.setQueryData<RoomMessage[]>(messagesKey, (old) => [
      ...(old ?? []),
      optimisticMessage,
    ]);

    const cached = queryClient.getQueryData<RoomMessage[]>(messagesKey);
    expect(cached).toHaveLength(2);
    expect(cached![1]!.content).toBe('On my way!');
    expect(cached![1]!.senderName).toBe('You');
    expect(cached![1]!.id.startsWith('temp-')).toBe(true);

    // Simulate rollback on error
    queryClient.setQueryData(messagesKey, previousMessages);
    const rolledBack = queryClient.getQueryData<RoomMessage[]>(messagesKey);
    expect(rolledBack).toHaveLength(1);
    expect(rolledBack![0]!.id).toBe('msg-1');
  });

  it('deduplicates incoming realtime messages against optimistic entries', () => {
    const initialMessages: RoomMessage[] = [
      {
        id: 'temp-123',
        activity_id: roomId,
        sender_id: 'current-user',
        content: 'Ready to play!',
        created_at: new Date().toISOString(),
        senderName: 'You',
      },
    ];

    queryClient.setQueryData(messagesKey, initialMessages);

    const incomingServerMessage = {
      id: 'server-confirmed-999',
      activity_id: roomId,
      sender_id: 'current-user',
      content: 'Ready to play!',
      created_at: new Date().toISOString(),
    };

    // Replicate realtime handler logic
    queryClient.setQueryData<RoomMessage[]>(messagesKey, (old = []) => {
      const isFromMe = incomingServerMessage.sender_id === 'current-user';
      const filtered = isFromMe
        ? old.filter((m) => !m.id.startsWith('temp-') || m.content !== incomingServerMessage.content)
        : old;

      return [
        ...filtered,
        {
          ...incomingServerMessage,
          senderName: 'You',
        },
      ];
    });

    const updated = queryClient.getQueryData<RoomMessage[]>(messagesKey);
    expect(updated).toHaveLength(1);
    expect(updated![0]!.id).toBe('server-confirmed-999');
    expect(updated![0]!.content).toBe('Ready to play!');
  });
});
