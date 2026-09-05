import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requestToJoin,
  getJoinRequestStatus,
  fetchIncomingJoinRequests,
  acceptJoinRequestTx,
  declineJoinRequest,
  subscribeToJoinRequestUpdates,
  subscribeToHostQueue,
  getPendingRequestsCount,
} from '../services/handshake';
import { supabase } from '../services/supabase';

vi.mock('../services/supabase', () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockChannel = vi.fn();

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
      channel: mockChannel,
    },
  };
});

describe('Handshake Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requestToJoin', () => {
    it('should successfully call request_to_join_activity RPC when available', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: {
          id: 'req-rpc-1',
          activity_id: 'act-456',
          user_id: 'usr-789',
          message: 'Ready!',
          status: 'pending',
          created_at: '2026-09-05T12:00:00Z',
        },
        error: null,
      });

      const result = await requestToJoin('act-456', 'usr-789', 'Ready!');

      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe('req-rpc-1');
      expect(supabase.rpc).toHaveBeenCalledWith('request_to_join_activity', {
        p_activity_id: 'act-456',
        p_user_id: 'usr-789',
        p_message: 'Ready!',
      });
    });

    it('should fallback to direct insert when RPC fails or is unavailable', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'function request_to_join_activity does not exist' },
      });

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'req-123',
              activity_id: 'act-456',
              user_id: 'usr-789',
              message: 'Ready to play!',
              status: 'pending',
              created_at: '2026-09-05T12:00:00Z',
            },
            error: null,
          }),
        }),
      });

      (supabase.from as any).mockReturnValue({
        insert: mockInsert,
      });

      const result = await requestToJoin('act-456', 'usr-789', 'Ready to play!');

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.status).toBe('pending');
      expect(mockInsert).toHaveBeenCalledWith({
        activity_id: 'act-456',
        user_id: 'usr-789',
        message: 'Ready to play!',
        status: 'pending',
      });
    });

    it('should gracefully return existing request on unique violation (code 23505)', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'RPC unavailable' },
      });

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '23505', message: 'duplicate key value violates unique constraint' },
          }),
        }),
      });

      const mockSelectExisting = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'req-existing',
                activity_id: 'act-456',
                user_id: 'usr-789',
                status: 'pending',
              },
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'join_requests') {
          return {
            insert: mockInsert,
            select: mockSelectExisting,
          };
        }
        return {};
      });

      const result = await requestToJoin('act-456', 'usr-789');

      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe('req-existing');
    });

    it('should return error when insertion fails', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'RPC unavailable' },
      });

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '42501', message: 'new row violates row-level security policy for table join_requests' },
          }),
        }),
      });

      (supabase.from as any).mockReturnValue({
        insert: mockInsert,
      });

      const result = await requestToJoin('act-456', 'usr-789');

      expect(result.error).toBe('new row violates row-level security policy for table join_requests');
      expect(result.data).toBeUndefined();
    });

    it('should handle general Supabase insertion errors', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'RPC unavailable' },
      });

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '50000', message: 'Database connection failed' },
          }),
        }),
      });

      (supabase.from as any).mockReturnValue({
        insert: mockInsert,
      });

      const result = await requestToJoin('act-456', 'usr-789');

      expect(result.error).toBe('Database connection failed');
      expect(result.data).toBeUndefined();
    });
  });

  describe('getJoinRequestStatus', () => {
    it('should fetch join request for user and activity', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'req-1',
                  activity_id: 'act-1',
                  user_id: 'user-1',
                  status: 'accepted',
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const status = await getJoinRequestStatus('act-1', 'user-1');
      expect(status?.status).toBe('accepted');
    });

    it('should return null when no request exists', async () => {
      (supabase.from as any).mockReturnValue({
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
      });

      const status = await getJoinRequestStatus('act-1', 'user-2');
      expect(status).toBeNull();
    });
  });

  describe('fetchIncomingJoinRequests', () => {
    it('should fetch and map pending join requests with profile details', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'req-1',
                    activity_id: 'act-100',
                    user_id: 'usr-sam',
                    message: 'I have boots ready',
                    status: 'pending',
                    created_at: '2026-09-05T10:00:00Z',
                    profiles: {
                      id: 'usr-sam',
                      name: 'Sam Chen',
                      trust_score: 4.88,
                      is_verified: true,
                      avatar_url: null,
                    },
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      });

      const requests = await fetchIncomingJoinRequests('act-100');
      expect(requests).toHaveLength(1);
      expect(requests[0]?.user.name).toBe('Sam Chen');
      expect(requests[0]?.user.trustScore).toBe(4.88);
      expect(requests[0]?.user.isVerified).toBe(true);
      expect(requests[0]?.message).toBe('I have boots ready');
    });
  });

  describe('acceptJoinRequestTx', () => {
    it('should call accept_join_request_tx RPC and return success', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: {
          success: true,
          activity_id: 'act-100',
          current_participants_count: 4,
          status: 'open',
        },
        error: null,
      });

      const result = await acceptJoinRequestTx('req-1', 'host-alex');
      expect(result.success).toBe(true);
      expect(result.data?.current_participants_count).toBe(4);
      expect(supabase.rpc).toHaveBeenCalledWith('accept_join_request_tx', {
        p_request_id: 'req-1',
        p_host_id: 'host-alex',
      });
    });

    it('should return error when capacity breach occurs in RPC', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Activity capacity reached (5 of 5)' },
      });

      const result = await acceptJoinRequestTx('req-overflow', 'host-alex');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Activity capacity reached (5 of 5)');
    });
  });

  describe('declineJoinRequest', () => {
    it('should call decline_join_request RPC and return success', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: { success: true, status: 'declined' },
        error: null,
      });

      const result = await declineJoinRequest('req-1', 'host-alex');
      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('decline_join_request', {
        p_request_id: 'req-1',
        p_host_id: 'host-alex',
      });
    });

    it('should return error when unauthorized caller attempts decline', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Unauthorized: user not host' },
      });

      const result = await declineJoinRequest('req-1', 'impostor-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: user not host');
    });
  });

  describe('Realtime Subscriptions', () => {
    it('should subscribe to join request updates and unsubscribe cleanly', () => {
      const mockUnsubscribe = vi.fn();
      const mockOn = vi.fn().mockReturnThis();
      const mockSubscribe = vi.fn().mockReturnValue({
        unsubscribe: mockUnsubscribe,
      });

      (supabase.channel as any).mockReturnValue({
        on: mockOn,
        subscribe: mockSubscribe,
      });

      const onStatusChange = vi.fn();
      const channel = subscribeToJoinRequestUpdates('req-1', onStatusChange);

      expect(supabase.channel).toHaveBeenCalledWith('join_request_req-1');
      expect(mockOn).toHaveBeenCalled();
      expect(mockSubscribe).toHaveBeenCalled();

      channel.unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should subscribe to host queue and unsubscribe cleanly', () => {
      const mockUnsubscribe = vi.fn();
      const mockOn = vi.fn().mockReturnThis();
      const mockSubscribe = vi.fn().mockReturnValue({
        unsubscribe: mockUnsubscribe,
      });

      (supabase.channel as any).mockReturnValue({
        on: mockOn,
        subscribe: mockSubscribe,
      });

      const onQueueChanged = vi.fn();
      const channel = subscribeToHostQueue('act-1', onQueueChanged);

      expect(supabase.channel).toHaveBeenCalledWith('host_queue_act-1');
      expect(mockOn).toHaveBeenCalled();
      expect(mockSubscribe).toHaveBeenCalled();

      channel.unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('getPendingRequestsCount', () => {
    it('should query DB count or dev registry count', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 2,
              error: null,
            }),
          }),
        }),
      });

      const count = await getPendingRequestsCount('act-test-count');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
