import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { ChatMessage, RoomMessageRow } from '@hobbie/shared';
import { queryKeys } from '../services/queryKeys';

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
    const initialMessages: ChatMessage[] = [
      {
        id: 'msg-1',
        activityId: roomId,
        senderId: 'user-other',
        senderName: 'Sam Chen',
        content: 'Hey everyone!',
        createdAt: new Date().toISOString(),
        isHost: false,
      },
    ];

    queryClient.setQueryData(messagesKey, initialMessages);

    // Simulate optimistic onMutate
    const outgoingContent = 'On my way!';
    const previousMessages = queryClient.getQueryData<ChatMessage[]>(messagesKey) ?? [];

    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      activityId: roomId,
      senderId: 'current-user',
      senderName: 'You',
      content: outgoingContent,
      createdAt: new Date().toISOString(),
      isHost: false,
    };

    queryClient.setQueryData<ChatMessage[]>(messagesKey, (old) => [
      ...(old ?? []),
      optimisticMessage,
    ]);

    const cached = queryClient.getQueryData<ChatMessage[]>(messagesKey);
    expect(cached).toHaveLength(2);
    expect(cached![1]!.content).toBe('On my way!');
    expect(cached![1]!.senderName).toBe('You');
    expect(cached![1]!.id.startsWith('temp-')).toBe(true);

    // Simulate rollback on error
    queryClient.setQueryData(messagesKey, previousMessages);
    const rolledBack = queryClient.getQueryData<ChatMessage[]>(messagesKey);
    expect(rolledBack).toHaveLength(1);
    expect(rolledBack![0]!.id).toBe('msg-1');
  });

  it('deduplicates incoming realtime messages against optimistic entries', () => {
    const initialMessages: ChatMessage[] = [
      {
        id: 'temp-123',
        activityId: roomId,
        senderId: 'current-user',
        senderName: 'You',
        content: 'Ready to play!',
        createdAt: new Date().toISOString(),
        isHost: false,
      },
    ];

    queryClient.setQueryData(messagesKey, initialMessages);

    // Raw Realtime payload is the snake_case DB row contract.
    const incomingServerRow: RoomMessageRow = {
      id: 'server-confirmed-999',
      activity_id: roomId,
      sender_id: 'current-user',
      content: 'Ready to play!',
      created_at: new Date().toISOString(),
    };

    // Replicate realtime handler mapping into the ChatMessage DTO
    queryClient.setQueryData<ChatMessage[]>(messagesKey, (old = []) => {
      const isFromMe = incomingServerRow.sender_id === 'current-user';
      const filtered = isFromMe
        ? old.filter((m) => !m.id.startsWith('temp-') || m.content !== incomingServerRow.content)
        : old;

      return [
        ...filtered,
        {
          id: incomingServerRow.id,
          activityId: incomingServerRow.activity_id,
          senderId: incomingServerRow.sender_id,
          senderName: isFromMe ? 'You' : 'Hobbie Player',
          content: incomingServerRow.content,
          createdAt: incomingServerRow.created_at,
          isHost: false,
        },
      ];
    });

    const updated = queryClient.getQueryData<ChatMessage[]>(messagesKey);
    expect(updated).toHaveLength(1);
    expect(updated![0]!.id).toBe('server-confirmed-999');
    expect(updated![0]!.content).toBe('Ready to play!');
  });
});
