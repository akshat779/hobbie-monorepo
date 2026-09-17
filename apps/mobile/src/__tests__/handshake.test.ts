import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requestToJoin,
  getJoinRequestStatus,
  fetchIncomingJoinRequests,
  acceptJoinRequestTx,
  declineJoinRequest,
  leaveSquad,
  subscribeToJoinRequestUpdates,
  subscribeToHostQueue,
  getPendingRequestsCount,
  getPendingRequestCounts,
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
    it('should call request_to_join_activity RPC and resolve the created request', async () => {
      const result = await requestToJoin(
        VALID_UUIDS.activity1,
        VALID_UUIDS.sam,
        'Ready to play!'
      );

      expect(result.id).toBe(VALID_UUIDS.request1);
      expect(result.activity_id).toBe(VALID_UUIDS.activity1);
      expect(result.status).toBe('pending');
      expect(supabase.rpc).toHaveBeenCalledWith('request_to_join_activity', {
        p_activity_id: VALID_UUIDS.activity1,
        p_user_id: VALID_UUIDS.sam,
        p_message: 'Ready to play!',
      });
    });

    it('should throw when activityId is not a valid UUID (Postgres 22P02 parity)', async () => {
      await expect(
        requestToJoin('not-a-valid-uuid', VALID_UUIDS.sam, 'Ready!')
      ).rejects.toThrow('invalid input syntax for type uuid');
    });

    it('should throw when userId is not a valid UUID', async () => {
      await expect(
        requestToJoin(VALID_UUIDS.activity1, 'not-a-user-uuid')
      ).rejects.toThrow('invalid input syntax for type uuid');
    });

    it('should throw when the atomic RPC is unavailable', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: { message: 'function request_to_join_activity does not exist' },
      });

      await expect(
        requestToJoin(VALID_UUIDS.activity1, VALID_UUIDS.sam, 'Fallback message')
      ).rejects.toThrow('does not exist');
    });

    it('should throw on unique violation when the request already exists (code 23505)', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "join_requests_activity_id_user_id_key"',
        },
      });

      await expect(
        requestToJoin(VALID_UUIDS.activity1, VALID_UUIDS.sam)
      ).rejects.toThrow('duplicate key value violates unique constraint');
    });

    it('should throw the atomic RPC error when the database rejects the operation', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC unavailable' },
      });

      await expect(
        requestToJoin(VALID_UUIDS.activity1, VALID_UUIDS.sam)
      ).rejects.toThrow('RPC unavailable');
    });

    it('should throw when the RPC resolves without a payload', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(
        requestToJoin(VALID_UUIDS.activity1, VALID_UUIDS.sam)
      ).rejects.toThrow('Atomic join-request operation is unavailable');
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
                  message: 'Ready to play!',
                  status: 'accepted',
                  created_at: '2026-09-05T10:00:00Z',
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
                      gender: 'non-binary',
                      interaction_count: 12,
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

  describe('getPendingRequestCounts', () => {
    it('should batch-map activity ids to pending counts in a single RPC call', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: [
          { activity_id: VALID_UUIDS.activity1, pending_count: 3 },
          { activity_id: VALID_UUIDS.activity2, pending_count: 0 },
        ],
        error: null,
      });

      const counts = await getPendingRequestCounts([
        VALID_UUIDS.activity1,
        VALID_UUIDS.activity2,
      ]);

      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(supabase.rpc).toHaveBeenCalledWith('get_pending_request_counts', {
        p_activity_ids: [VALID_UUIDS.activity1, VALID_UUIDS.activity2],
      });
      expect(counts.get(VALID_UUIDS.activity1)).toBe(3);
      expect(counts.get(VALID_UUIDS.activity2)).toBe(0);
    });

    it('should short-circuit without an RPC call when given no ids', async () => {
      const counts = await getPendingRequestCounts([]);

      expect(counts.size).toBe(0);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('should return an empty map when the RPC errors', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: { message: 'function get_pending_request_counts does not exist' },
      });

      const counts = await getPendingRequestCounts([VALID_UUIDS.activity1]);

      expect(counts.size).toBe(0);
    });
  });

  describe('leaveSquad', () => {
    it('should successfully execute leave_activity RPC with valid UUIDs', async () => {
      const result = await leaveSquad(VALID_UUIDS.activity1, VALID_UUIDS.sam);

      expect(result.success).toBe(true);
      const data = result.data;
      if (!data) throw new Error('Expected leave_activity to return data');
      expect(data.activity_id).toBe(VALID_UUIDS.activity1);
      expect(data.user_id).toBe(VALID_UUIDS.sam);
      expect(data.new_host_id).toBe(VALID_UUIDS.alex);
      expect(supabase.rpc).toHaveBeenCalledWith('leave_activity', {
        p_activity_id: VALID_UUIDS.activity1,
        p_user_id: VALID_UUIDS.sam,
      });
    });

    it('should reject when activityId is not a valid UUID', async () => {
      const result = await leaveSquad('not-a-valid-uuid', VALID_UUIDS.sam);

      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid input syntax for type uuid');
    });

    it('should reject when userId is not a valid UUID', async () => {
      const result = await leaveSquad(VALID_UUIDS.activity1, 'invalid-user-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid input syntax for type uuid');
    });

    it('should handle RPC errors gracefully when caller is not a member', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: { message: 'User is not an active member of activity' },
      });

      const result = await leaveSquad(VALID_UUIDS.activity1, VALID_UUIDS.sam);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User is not an active member of activity');
    });
  });
});
