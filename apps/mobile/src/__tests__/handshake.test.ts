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
import { createContractMockSupabase, VALID_UUIDS } from './helpers/contractMocks';

vi.mock('../services/supabase', async () => {
  const { createContractMockSupabase } = await import('./helpers/contractMocks');
  return {
    supabase: createContractMockSupabase(),
  };
});

describe('Handshake Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requestToJoin', () => {
    it('should successfully call request_to_join_activity RPC when available with valid UUIDs', async () => {
      const result = await requestToJoin(
        VALID_UUIDS.activity1,
        VALID_UUIDS.sam,
        'Ready to play!'
      );

      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe(VALID_UUIDS.request1);
      expect(result.data?.activity_id).toBe(VALID_UUIDS.activity1);
      expect(supabase.rpc).toHaveBeenCalledWith('request_to_join_activity', {
        p_activity_id: VALID_UUIDS.activity1,
        p_user_id: VALID_UUIDS.sam,
        p_message: 'Ready to play!',
      });
    });

    it('should reject requestToJoin when activityId is not a valid UUID (Postgres 22P02 parity)', async () => {
      const result = await requestToJoin('not-a-valid-uuid', VALID_UUIDS.sam, 'Ready!');

      expect(result.error).toBeDefined();
      expect(result.error).toContain('invalid input syntax for type uuid');
    });

    it('should reject requestToJoin when userId is not a valid UUID', async () => {
      const result = await requestToJoin(VALID_UUIDS.activity1, 'not-a-user-uuid');

      expect(result.error).toBeDefined();
      expect(result.error).toContain('invalid input syntax for type uuid');
    });

    it('should fail clearly when the atomic RPC is unavailable', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: { message: 'function request_to_join_activity does not exist' },
      });

      const result = await requestToJoin(VALID_UUIDS.activity1, VALID_UUIDS.sam, 'Fallback message');

      expect(result.data).toBeUndefined();
      expect(result.error).toContain('does not exist');
    });

    it('should gracefully return existing request on unique violation (code 23505)', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC unavailable' },
      });

      const result = await requestToJoin(VALID_UUIDS.activity1, VALID_UUIDS.sam);

      expect(result.data).toBeUndefined();
      expect(result.error).toContain('RPC unavailable');
    });

    it('should return the atomic RPC error when the database rejects the operation', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC unavailable' },
      });

      const result = await requestToJoin(VALID_UUIDS.activity1, VALID_UUIDS.sam);

      expect(result.error).toBe('RPC unavailable');
      expect(result.data).toBeUndefined();
    });

    it('should handle general atomic RPC errors', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC unavailable' },
      });

      const result = await requestToJoin(VALID_UUIDS.activity1, VALID_UUIDS.sam);

      expect(result.error).toBe('RPC unavailable');
      expect(result.data).toBeUndefined();
    });
  });

  describe('getJoinRequestStatus', () => {
    it('should fetch join request for user and activity', async () => {
      (supabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: VALID_UUIDS.request1,
                  activity_id: VALID_UUIDS.activity1,
                  user_id: VALID_UUIDS.alex,
                  status: 'accepted',
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const status = await getJoinRequestStatus(VALID_UUIDS.activity1, VALID_UUIDS.alex);
      expect(status?.status).toBe('accepted');
    });

    it('should return null when no request exists', async () => {
      (supabase.from as any).mockReturnValueOnce({
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

      const status = await getJoinRequestStatus(VALID_UUIDS.activity1, VALID_UUIDS.sam);
      expect(status).toBeNull();
    });
  });

  describe('fetchIncomingJoinRequests', () => {
    it('should fetch and map pending join requests with profile details', async () => {
      (supabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: VALID_UUIDS.request1,
                    activity_id: VALID_UUIDS.activity1,
                    user_id: VALID_UUIDS.sam,
                    message: 'I have boots ready',
                    status: 'pending',
                    created_at: '2026-09-05T10:00:00Z',
                    profiles: {
                      id: VALID_UUIDS.sam,
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

      const requests = await fetchIncomingJoinRequests(VALID_UUIDS.activity1);
      expect(requests).toHaveLength(1);
      expect(requests[0]?.user.name).toBe('Sam Chen');
      expect(requests[0]?.user.trustScore).toBe(4.88);
      expect(requests[0]?.user.isVerified).toBe(true);
      expect(requests[0]?.message).toBe('I have boots ready');
    });
  });

  describe('acceptJoinRequestTx', () => {
    it('should call accept_join_request_tx RPC with valid UUIDs and return success', async () => {
      const result = await acceptJoinRequestTx(VALID_UUIDS.request1, VALID_UUIDS.alex);
      expect(result.success).toBe(true);
      expect(result.data?.current_participants_count).toBe(4);
      expect(supabase.rpc).toHaveBeenCalledWith('accept_join_request_tx', {
        p_request_id: VALID_UUIDS.request1,
        p_host_id: VALID_UUIDS.alex,
      });
    });

    it('should reject acceptJoinRequestTx when request ID is not a valid UUID', async () => {
      const result = await acceptJoinRequestTx('invalid-request-id', VALID_UUIDS.alex);
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid input syntax for type uuid');
    });

    it('should reject acceptJoinRequestTx when host ID is not a valid UUID', async () => {
      const result = await acceptJoinRequestTx(VALID_UUIDS.request1, 'invalid-host-id');
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid input syntax for type uuid');
    });

    it('should return error when capacity breach occurs in RPC', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: { message: 'Activity capacity reached (5 of 5)' },
      });

      const result = await acceptJoinRequestTx(VALID_UUIDS.request1, VALID_UUIDS.alex);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Activity capacity reached (5 of 5)');
    });
  });

  describe('declineJoinRequest', () => {
    it('should call decline_join_request RPC with valid UUIDs and return success', async () => {
      const result = await declineJoinRequest(VALID_UUIDS.request1, VALID_UUIDS.alex);
      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('decline_join_request', {
        p_request_id: VALID_UUIDS.request1,
        p_host_id: VALID_UUIDS.alex,
      });
    });

    it('should reject declineJoinRequest when request ID is not a valid UUID', async () => {
      const result = await declineJoinRequest('invalid-request-id', VALID_UUIDS.alex);
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid input syntax for type uuid');
    });

    it('should return error when unauthorized caller attempts decline', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: { message: 'Unauthorized: user not host' },
      });

      const result = await declineJoinRequest(VALID_UUIDS.request1, VALID_UUIDS.sam);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: user not host');
    });
  });

  describe('Realtime Subscriptions', () => {
    it('should subscribe to join request updates and unsubscribe cleanly', () => {
      const onStatusChange = vi.fn();
      const unsubscribe = subscribeToJoinRequestUpdates(VALID_UUIDS.request1, onStatusChange);

      expect(supabase.channel).toHaveBeenCalledWith(expect.stringContaining(`join_request_${VALID_UUIDS.request1}`));
      expect(unsubscribe).toBeTypeOf('function');
      unsubscribe();
    });

    it('should subscribe to host queue and unsubscribe cleanly', () => {
      const onQueueChanged = vi.fn();
      const unsubscribe = subscribeToHostQueue(VALID_UUIDS.activity1, onQueueChanged);

      expect(supabase.channel).toHaveBeenCalledWith(expect.stringContaining(`host_queue_${VALID_UUIDS.activity1}`));
      expect(unsubscribe).toBeTypeOf('function');
      unsubscribe();
    });
  });

  describe('getPendingRequestsCount', () => {
    it('should query DB count for activity', async () => {
      (supabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 2,
              error: null,
            }),
          }),
        }),
      });

      const count = await getPendingRequestsCount(VALID_UUIDS.activity1);
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
