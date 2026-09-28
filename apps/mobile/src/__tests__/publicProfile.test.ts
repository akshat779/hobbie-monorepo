import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchPublicProfile, getFuzzedDistance } from '../services/publicProfile';
import {
  blockUser,
  unblockUser,
  reportUser,
  getMyBlockedIds,
  hasBlockedUser,
} from '../services/moderation';
import { supabase } from '../services/supabase';
import { createContractMockSupabase, VALID_UUIDS } from './helpers/contractMocks';

vi.mock('../services/supabase', async () => {
  const { createContractMockSupabase } = await import('./helpers/contractMocks');
  return {
    supabase: createContractMockSupabase(),
  };
});

const profileRow = {
  id: VALID_UUIDS.sam,
  name: 'Sam Chen',
  birth_date: '2000-08-22',
  gender: 'female',
  interests: ['football'],
  bio: null,
  preferred_languages: ['en'],
  avatar_url: null,
  photo_urls: ['https://cdn.example.com/a.jpg'],
  is_verified: true,
  trust_score: 4.88,
  interaction_count: 12,
  ratings_count: 0,
  created_at: '2026-09-05T10:00:00Z',
};

describe('publicProfile service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps a DB row into a validated PublicProfile', async () => {
    (supabase.from as any).mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: profileRow, error: null }),
        }),
      }),
    });

    const profile = await fetchPublicProfile(VALID_UUIDS.sam);

    expect(profile?.name).toBe('Sam Chen');
    expect(profile?.ratingsCount).toBe(0);
    expect(profile?.photoUrls).toHaveLength(1);
    expect(profile?.preferredLanguages).toEqual(['en']);
  });

  it('returns null when the row violates the public profile contract', async () => {
    (supabase.from as any).mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { ...profileRow, trust_score: 9 }, error: null }),
        }),
      }),
    });

    expect(await fetchPublicProfile(VALID_UUIDS.sam)).toBeNull();
  });

  it('maps the snake_case fuzzed-distance payload', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({
      data: { available: true, distance_m: 1200 },
      error: null,
    });

    expect(await getFuzzedDistance(VALID_UUIDS.sam)).toEqual({
      available: true,
      distanceM: 1200,
    });
  });

  it('reports distance as unavailable when the RPC fails', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: null, error: { message: 'nope' } });
    expect(await getFuzzedDistance(VALID_UUIDS.sam)).toEqual({ available: false });
  });
});

describe('moderation service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks a user through the RPC contract', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({
      data: { success: true, blocked_id: VALID_UUIDS.sam },
      error: null,
    });

    expect(await blockUser(VALID_UUIDS.sam)).toEqual({ success: true });
    expect(supabase.rpc).toHaveBeenCalledWith('block_user', { p_blocked_id: VALID_UUIDS.sam });
  });

  it('unblocks a user through the RPC contract', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({
      data: { success: true, blocked_id: VALID_UUIDS.sam },
      error: null,
    });

    expect(await unblockUser(VALID_UUIDS.sam)).toEqual({ success: true });
    expect(supabase.rpc).toHaveBeenCalledWith('unblock_user', { p_blocked_id: VALID_UUIDS.sam });
  });

  it('surfaces an RPC error instead of a fabricated success', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({
      data: null,
      error: { message: 'Cannot block yourself' },
    });

    const res = await blockUser(VALID_UUIDS.sam);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Cannot block');
  });

  it('rejects an invalid report before touching the database', async () => {
    const res = await reportUser({ targetUserId: 'not-a-uuid', reason: 'spam' });
    expect(res.success).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('inserts a validated report for the signed-in user', async () => {
    const insert = vi.fn(async () => ({ error: null }));
    (supabase.from as any).mockReturnValueOnce({ insert });

    const res = await reportUser({
      targetUserId: VALID_UUIDS.sam,
      reason: 'harassment',
      notes: 'abusive messages',
    });

    expect(res.success).toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        reporter_id: VALID_UUIDS.alex,
        target_user_id: VALID_UUIDS.sam,
        reason: 'harassment',
      })
    );
  });

  it('lists blocked ids and single-user block state', async () => {
    (supabase.from as any)
      .mockReturnValueOnce({
        select: () => ({
          eq: async () => ({ data: [{ blocked_id: VALID_UUIDS.sam }], error: null }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { blocked_id: VALID_UUIDS.sam }, error: null }),
            }),
          }),
        }),
      });

    expect(await getMyBlockedIds()).toEqual([VALID_UUIDS.sam]);
    expect(await hasBlockedUser(VALID_UUIDS.sam)).toBe(true);
  });
});
