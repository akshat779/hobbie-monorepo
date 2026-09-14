import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryKeys';
import {
  getReviewRequestMutationOptions,
  getJoinRequestMutationOptions,
} from '../features/activity/useActivityMutations';
import * as handshakeService from '../services/handshake';
import { ActivityDetails } from '../services/activityDetail';
import { MySquadItem } from '../features/activity/useMyActivitiesQuery';
import { IncomingJoinRequest } from '../services/handshake';

let testQueryClient: QueryClient;

vi.mock('../services/supabase', async () => {
  const { createContractMockSupabase } = await import('./helpers/contractMocks');
  return {
    supabase: createContractMockSupabase(),
  };
});

vi.mock('../services/handshake', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/handshake')>();
  return {
    ...actual,
    acceptJoinRequestTx: vi.fn(),
    declineJoinRequest: vi.fn(),
    requestToJoin: vi.fn(),
  };
});

describe('Optimistic UI Mutations & Rollback Contracts', () => {
  const activityId = '11111111-1111-1111-1111-111111111111';
  const hostId = '22222222-2222-2222-2222-222222222222';
  const userId = '33333333-3333-3333-3333-333333333333';
  const requestId = '44444444-4444-4444-4444-444444444444';

  const hostRequestsKey = queryKeys.activities.hostRequests(activityId);
  const detailKey = queryKeys.activities.detail(activityId);
  const mySquadsKey = queryKeys.activities.mySquads(hostId);
  const joinStatusKey = queryKeys.activities.joinStatus(activityId, userId);

  beforeEach(() => {
    vi.clearAllMocks();
    testQueryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  describe('useReviewRequestMutation (Host Review Queue)', () => {
    const initialRequests: IncomingJoinRequest[] = [
      {
        id: requestId,
        activityId,
        userId,
        message: 'Can I join?',
        status: 'pending',
        createdAt: new Date().toISOString(),
        user: {
          id: userId,
          name: 'Alex Player',
          trustScore: 4.9,
          isVerified: true,
          avatarUrl: null,
        },
      },
      {
        id: 'other-request-id',
        activityId,
        userId: 'other-user',
        message: 'Second player',
        status: 'pending',
        createdAt: new Date().toISOString(),
        user: {
          id: 'other-user',
          name: 'Sam Player',
          trustScore: 4.8,
          isVerified: false,
          avatarUrl: null,
        },
      },
    ];

    const initialDetail: ActivityDetails = {
      id: activityId,
      hostId,
      hostName: 'Host User',
      hostTrustScore: 5.0,
      hostIsVerified: true,
      title: 'Saturday Badminton',
      description: 'Casual games',
      venueName: 'Arena 1',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      maxParticipants: 4,
      currentParticipantsCount: 3,
      status: 'open',
    };

    const initialSquads: MySquadItem[] = [
      {
        id: activityId,
        title: 'Saturday Badminton',
        interestId: 'badminton',
        hostId,
        venueName: 'Arena 1',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        currentParticipantsCount: 3,
        maxParticipants: 4,
        status: 'open',
        isHost: true,
        pendingRequestsCount: 2,
      },
    ];

    it('optimistically removes request, increments participants, and sets status to full when capacity reached', async () => {
      testQueryClient.setQueryData(hostRequestsKey, initialRequests);
      testQueryClient.setQueryData(detailKey, initialDetail);
      testQueryClient.setQueryData(mySquadsKey, initialSquads);

      (handshakeService.acceptJoinRequestTx as any).mockResolvedValue({
        success: true,
        data: { current_participants_count: 4, status: 'full' },
      });

      const options = getReviewRequestMutationOptions(testQueryClient);
      const mutation = testQueryClient.getMutationCache().build(testQueryClient, options);

      await mutation.execute({
        action: 'accept',
        requestId,
        hostId,
        activityId,
      });

      // Request was optimistically removed from hostRequests
      const updatedRequests = testQueryClient.getQueryData<IncomingJoinRequest[]>(hostRequestsKey);
      expect(updatedRequests).toHaveLength(1);
      expect(updatedRequests![0].id).toBe('other-request-id');

      // Activity detail participant count was incremented and status updated to 'full'
      const updatedDetail = testQueryClient.getQueryData<ActivityDetails>(detailKey);
      expect(updatedDetail?.currentParticipantsCount).toBe(4);
      expect(updatedDetail?.status).toBe('full');

      // MySquads item participant count incremented and pendingRequestsCount decremented
      const updatedSquads = testQueryClient.getQueryData<MySquadItem[]>(mySquadsKey);
      expect(updatedSquads![0].currentParticipantsCount).toBe(4);
      expect(updatedSquads![0].pendingRequestsCount).toBe(1);
      expect(updatedSquads![0].status).toBe('full');
    });

    it('rolls back all caches to snapshot if acceptJoinRequestTx fails', async () => {
      testQueryClient.setQueryData(hostRequestsKey, initialRequests);
      testQueryClient.setQueryData(detailKey, initialDetail);
      testQueryClient.setQueryData(mySquadsKey, initialSquads);

      (handshakeService.acceptJoinRequestTx as any).mockResolvedValue({
        success: false,
        error: 'Activity capacity reached concurrently',
      });

      const options = getReviewRequestMutationOptions(testQueryClient);
      const mutation = testQueryClient.getMutationCache().build(testQueryClient, options);

      await expect(
        mutation.execute({
          action: 'accept',
          requestId,
          hostId,
          activityId,
        })
      ).rejects.toThrow('Activity capacity reached concurrently');

      // Check that caches rolled back to initial state
      const rolledBackRequests = testQueryClient.getQueryData<IncomingJoinRequest[]>(hostRequestsKey);
      expect(rolledBackRequests).toHaveLength(2);
      expect(rolledBackRequests![0].id).toBe(requestId);

      const rolledBackDetail = testQueryClient.getQueryData<ActivityDetails>(detailKey);
      expect(rolledBackDetail?.currentParticipantsCount).toBe(3);
      expect(rolledBackDetail?.status).toBe('open');

      const rolledBackSquads = testQueryClient.getQueryData<MySquadItem[]>(mySquadsKey);
      expect(rolledBackSquads![0].currentParticipantsCount).toBe(3);
      expect(rolledBackSquads![0].pendingRequestsCount).toBe(2);
    });

    it('optimistically decrements pendingRequestsCount on decline and rolls back on error', async () => {
      testQueryClient.setQueryData(hostRequestsKey, initialRequests);
      testQueryClient.setQueryData(detailKey, initialDetail);
      testQueryClient.setQueryData(mySquadsKey, initialSquads);

      (handshakeService.declineJoinRequest as any).mockResolvedValue({
        success: true,
      });

      const options = getReviewRequestMutationOptions(testQueryClient);
      const mutation = testQueryClient.getMutationCache().build(testQueryClient, options);

      await mutation.execute({
        action: 'decline',
        requestId,
        hostId,
        activityId,
      });

      // Request removed from host queue
      const updatedRequests = testQueryClient.getQueryData<IncomingJoinRequest[]>(hostRequestsKey);
      expect(updatedRequests).toHaveLength(1);

      // Pending requests count decremented, participants count unchanged
      const updatedSquads = testQueryClient.getQueryData<MySquadItem[]>(mySquadsKey);
      expect(updatedSquads![0].currentParticipantsCount).toBe(3);
      expect(updatedSquads![0].pendingRequestsCount).toBe(1);
    });
  });

  describe('useJoinRequestMutation (Joiner Handshake)', () => {
    it('optimistically sets joinStatus to pending before server responds', async () => {
      testQueryClient.setQueryData(joinStatusKey, null);

      (handshakeService.requestToJoin as any).mockResolvedValue({
        data: {
          id: 'server-confirmed-request-id',
          activity_id: activityId,
          user_id: userId,
          message: 'Can I join?',
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      });

      const options = getJoinRequestMutationOptions(testQueryClient);
      const mutation = testQueryClient.getMutationCache().build(testQueryClient, options);

      await mutation.execute({
        activityId,
        userId,
        message: 'Can I join?',
      });

      const cachedStatus = testQueryClient.getQueryData<any>(joinStatusKey);
      expect(cachedStatus).toBeDefined();
      expect(cachedStatus.status).toBe('pending');
      expect(cachedStatus.activity_id).toBe(activityId);
    });

    it('rolls back joinStatus if requestToJoin rejects', async () => {
      testQueryClient.setQueryData(joinStatusKey, null);

      (handshakeService.requestToJoin as any).mockRejectedValue(
        new Error('Network disconnected')
      );

      const options = getJoinRequestMutationOptions(testQueryClient);
      const mutation = testQueryClient.getMutationCache().build(testQueryClient, options);

      await expect(
        mutation.execute({
          activityId,
          userId,
          message: 'Can I join?',
        })
      ).rejects.toThrow('Network disconnected');

      const cachedStatus = testQueryClient.getQueryData(joinStatusKey);
      expect(cachedStatus).toBeNull();
    });
  });

  describe('Optimistic Leave Squad Pattern', () => {
    it('prunes squad immediately from mySquads and rolls back on failure', () => {
      const initialSquads: MySquadItem[] = [
        {
          id: activityId,
          title: 'Squad 1',
          interestId: 'football',
          hostId: 'host-1',
          venueName: 'Turf',
          expiresAt: new Date().toISOString(),
          currentParticipantsCount: 5,
          maxParticipants: 10,
          status: 'open',
          isHost: false,
        },
        {
          id: 'squad-2',
          title: 'Squad 2',
          interestId: 'badminton',
          hostId: 'host-2',
          venueName: 'Smash',
          expiresAt: new Date().toISOString(),
          currentParticipantsCount: 4,
          maxParticipants: 4,
          status: 'full',
          isHost: false,
        },
      ];

      testQueryClient.setQueryData(mySquadsKey, initialSquads);

      // Snapshot
      const previousSquads = testQueryClient.getQueryData<MySquadItem[]>(mySquadsKey);

      // Optimistic prune
      testQueryClient.setQueryData<MySquadItem[]>(mySquadsKey, (old = []) =>
        old.filter((s) => s.id !== activityId)
      );

      const afterPrune = testQueryClient.getQueryData<MySquadItem[]>(mySquadsKey);
      expect(afterPrune).toHaveLength(1);
      expect(afterPrune![0].id).toBe('squad-2');

      // Simulate failure rollback
      testQueryClient.setQueryData(mySquadsKey, previousSquads);
      const afterRollback = testQueryClient.getQueryData<MySquadItem[]>(mySquadsKey);
      expect(afterRollback).toHaveLength(2);
      expect(afterRollback![0].id).toBe(activityId);
    });
  });
});
