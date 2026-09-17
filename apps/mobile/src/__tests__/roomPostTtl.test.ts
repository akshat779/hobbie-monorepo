import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRoomMessages, sendRoomMessage, fetchRoomMetadata } from '../services/room';
import { supabase } from '../services/supabase';
import { VALID_UUIDS } from './helpers/contractMocks';

vi.mock('../services/supabase', () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(),
    },
  };
});

describe('Room Chat Post-TTL Behavior', () => {
  const activityId = VALID_UUIDS.activity1;
  const currentUserId = VALID_UUIDS.alex;
  const msgOneId = '55555555-5555-5555-5555-555555555555';
  const msgTwoId = '66666666-6666-6666-6666-666666666666';
  const insertedMsgId = '77777777-7777-7777-7777-777777777777';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows accepted squad members to fetch room messages even after squad TTL has expired', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: currentUserId } },
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'activity_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'membership-1' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'room_messages') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: msgOneId,
                    activity_id: activityId,
                    sender_id: currentUserId,
                    content: 'Still meeting up at the turf?',
                    created_at: new Date(Date.now() - 3600000).toISOString(),
                  },
                  {
                    id: msgTwoId,
                    activity_id: activityId,
                    sender_id: VALID_UUIDS.sam,
                    content: 'Yes! See you in 15 mins.',
                    created_at: new Date(Date.now() - 1800000).toISOString(),
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: currentUserId, name: 'Alex Rivera' },
                { id: VALID_UUIDS.sam, name: 'Sam Chen' },
              ],
            }),
          }),
        };
      }

      if (table === 'activities') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { host_id: currentUserId },
                error: null,
              }),
            }),
          }),
        };
      }

      return {};
    });

    const messages = await fetchRoomMessages(activityId);

    expect(messages).toHaveLength(2);
    expect(messages[0].senderName).toBe('Alex Rivera');
    expect(messages[0].content).toBe('Still meeting up at the turf?');
    expect(messages[1].senderName).toBe('Sam Chen');
    expect(messages[1].content).toBe('Yes! See you in 15 mins.');
  });

  it('allows accepted squad members to send room messages post-TTL without throwing expiration errors', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: currentUserId } },
    });

    const insertedMsg = {
      id: insertedMsgId,
      activity_id: activityId,
      sender_id: currentUserId,
      content: 'I arrived at the venue',
      created_at: new Date().toISOString(),
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'activity_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'membership-1' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'room_messages') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: insertedMsg,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { name: 'Alex Rivera' },
              }),
            }),
          }),
        };
      }

      if (table === 'activities') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { host_id: currentUserId },
                error: null,
              }),
            }),
          }),
        };
      }

      return {};
    });

    const result = await sendRoomMessage(activityId, 'I arrived at the venue');

    expect(result.id).toBe(insertedMsgId);
    expect(result.content).toBe('I arrived at the venue');
    expect(result.senderName).toBe('Alex Rivera');
  });

  it('rejects users who are not accepted squad members', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: 'random-user' } },
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'activity_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(fetchRoomMessages(activityId)).rejects.toThrow(
      'You must be an accepted squad member to access this room'
    );
  });
});
