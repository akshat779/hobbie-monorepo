import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  concludeActivity,
  fetchActivityExactLocation,
  fetchRoomMembers,
} from '../services/room';
import { supabase } from '../services/supabase';

vi.mock('../services/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe('Milestone 4: Room, Location & Conclusion Services', () => {
  const activityId = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';
  const hostId = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('concludeActivity', () => {
    it('calls conclude_activity_tx with activityId and hostId', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { success: true, activity_id: activityId, status: 'concluded' },
        error: null,
      } as any);

      await concludeActivity(activityId, hostId);

      expect(supabase.rpc).toHaveBeenCalledWith('conclude_activity_tx', {
        p_activity_id: activityId,
        p_host_id: hostId,
      });
    });

    it('throws when conclude_activity_tx returns error', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Unauthorized host' },
      } as any);

      await expect(concludeActivity(activityId, hostId)).rejects.toThrow(
        'Unauthorized host'
      );
    });
  });

  describe('fetchActivityExactLocation', () => {
    it('returns parsed latitude and longitude from RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { latitude: 12.9716, longitude: 77.5946 },
        error: null,
      } as any);

      const location = await fetchActivityExactLocation(activityId);

      expect(supabase.rpc).toHaveBeenCalledWith('get_activity_exact_location', {
        p_activity_id: activityId,
      });
      expect(location).toEqual({
        latitude: 12.9716,
        longitude: 77.5946,
      });
    });

    it('throws error when RPC fails', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Access denied: not a member' },
      } as any);

      await expect(fetchActivityExactLocation(activityId)).rejects.toThrow(
        'Access denied: not a member'
      );
    });
  });

  describe('fetchRoomMembers', () => {
    const memberOneId = '11111111-1111-1111-1111-111111111111';
    const memberTwoId = '22222222-2222-2222-2222-222222222222';

    it('calls get_activity_members RPC and returns enriched member list', async () => {
      const mockRpcMembers = [
        {
          user_id: memberOneId,
          name: 'Alex Host',
          avatar_url: 'https://avatar1.jpg',
          is_host: true,
          trust_score: 4.8,
          gender: 'male',
          is_verified: true,
          interaction_count: 18,
        },
        {
          user_id: memberTwoId,
          name: 'Sam Joiner',
          avatar_url: null,
          is_host: false,
          trust_score: 4.9,
          gender: 'non-binary',
          is_verified: true,
          interaction_count: 12,
        },
      ];

      vi.mocked(supabase.rpc).mockImplementation((fn: any, args: any) => {
        if (fn === 'get_activity_members') {
          expect(args).toEqual({ p_activity_id: activityId });
          return Promise.resolve({ data: mockRpcMembers, error: null }) as any;
        }
        return Promise.resolve({ data: null, error: null }) as any;
      });

      const members = await fetchRoomMembers(activityId);

      expect(members).toHaveLength(2);
      expect(members[0]).toEqual({
        id: memberOneId,
        name: 'Alex Host',
        gender: 'male',
        avatarUrl: 'https://avatar1.jpg',
        isVerified: true,
        trustScore: 4.8,
        interactionCount: 18,
        isHost: true,
      });
      expect(members[1]).toEqual({
        id: memberTwoId,
        name: 'Sam Joiner',
        gender: 'non-binary',
        avatarUrl: null,
        isVerified: true,
        trustScore: 4.9,
        interactionCount: 12,
        isHost: false,
      });
    });

    it('returns empty array when RPC returns no members', async () => {
      vi.mocked(supabase.rpc).mockImplementation((fn: any) => {
        if (fn === 'get_activity_members') {
          return Promise.resolve({ data: [], error: null }) as any;
        }
        return Promise.resolve({ data: null, error: null }) as any;
      });

      const members = await fetchRoomMembers(activityId);
      expect(members).toEqual([]);
    });

    it('throws error when get_activity_members RPC fails', async () => {
      vi.mocked(supabase.rpc).mockImplementation((fn: any) => {
        if (fn === 'get_activity_members') {
          return Promise.resolve({ data: null, error: { message: 'Unauthorized' } }) as any;
        }
        return Promise.resolve({ data: null, error: null }) as any;
      });

      await expect(fetchRoomMembers(activityId)).rejects.toThrow('Unauthorized');
    });
  });

  describe('My Squads Card State Machine Transitions', () => {
    function computeCardActions(squad: {
      isHost: boolean;
      status: string;
      isExpired: boolean;
      hasReviewed?: boolean;
    }) {
      const isConcluded = squad.status === 'concluded';
      const showRequestsButton = squad.isHost && !squad.isExpired && !isConcluded;
      const showConcludeButton = squad.isHost && squad.isExpired && !isConcluded;
      const showRateButton = isConcluded && !squad.hasReviewed;

      return { showRequestsButton, showConcludeButton, showRateButton };
    }

    it('shows Requests button only to host while unexpired and not concluded', () => {
      const hostUnexpired = computeCardActions({
        isHost: true,
        status: 'open',
        isExpired: false,
      });
      expect(hostUnexpired.showRequestsButton).toBe(true);
      expect(hostUnexpired.showConcludeButton).toBe(false);
      expect(hostUnexpired.showRateButton).toBe(false);

      const joinerUnexpired = computeCardActions({
        isHost: false,
        status: 'open',
        isExpired: false,
      });
      expect(joinerUnexpired.showRequestsButton).toBe(false);
      expect(joinerUnexpired.showConcludeButton).toBe(false);
      expect(joinerUnexpired.showRateButton).toBe(false);
    });

    it('hides Requests button and shows Conclude button to host once TTL expires', () => {
      const hostExpired = computeCardActions({
        isHost: true,
        status: 'open',
        isExpired: true,
      });
      expect(hostExpired.showRequestsButton).toBe(false);
      expect(hostExpired.showConcludeButton).toBe(true);
      expect(hostExpired.showRateButton).toBe(false);

      const joinerExpired = computeCardActions({
        isHost: false,
        status: 'open',
        isExpired: true,
      });
      expect(joinerExpired.showRequestsButton).toBe(false);
      expect(joinerExpired.showConcludeButton).toBe(false);
      expect(joinerExpired.showRateButton).toBe(false);
    });

    it('shows Rate Squad button to both host and joiners when concluded if unreviewed', () => {
      const hostConcludedUnreviewed = computeCardActions({
        isHost: true,
        status: 'concluded',
        isExpired: true,
        hasReviewed: false,
      });
      expect(hostConcludedUnreviewed.showRequestsButton).toBe(false);
      expect(hostConcludedUnreviewed.showConcludeButton).toBe(false);
      expect(hostConcludedUnreviewed.showRateButton).toBe(true);

      const joinerConcludedUnreviewed = computeCardActions({
        isHost: false,
        status: 'concluded',
        isExpired: true,
        hasReviewed: false,
      });
      expect(joinerConcludedUnreviewed.showRequestsButton).toBe(false);
      expect(joinerConcludedUnreviewed.showConcludeButton).toBe(false);
      expect(joinerConcludedUnreviewed.showRateButton).toBe(true);
    });

    it('hides Rate Squad button once user has reviewed', () => {
      const reviewed = computeCardActions({
        isHost: false,
        status: 'concluded',
        isExpired: true,
        hasReviewed: true,
      });
      expect(reviewed.showRequestsButton).toBe(false);
      expect(reviewed.showConcludeButton).toBe(false);
      expect(reviewed.showRateButton).toBe(false);
    });
  });
});
