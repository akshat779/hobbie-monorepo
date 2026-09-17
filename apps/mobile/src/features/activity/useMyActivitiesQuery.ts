import { useQuery } from '@tanstack/react-query';
import { ActivityPublic } from '@hobbie/shared';
import { supabase } from '../../services/supabase';
import { queryKeys } from '../../services/queryKeys';
import { getPendingRequestCounts } from '../../services/handshake';

const MY_SQUAD_COLUMNS =
  'id, host_id, interest_id, title, description, tier, fuzzed_location, venue_name, expires_at, max_participants, current_participants_count, filter_gender, filter_age_min, filter_age_max, status, created_at, image_urls, ttl_hours';

/**
 * My-squads projection derived from the shared `ActivityPublic` contract plus
 * the host-specific view flags. This is a narrowing of the domain DTO, not a
 * re-declaration of it; `interestId` stays the raw taxonomy key for display.
 */
export type MySquadItem = Pick<
  ActivityPublic,
  | 'id'
  | 'hostId'
  | 'title'
  | 'venueName'
  | 'expiresAt'
  | 'currentParticipantsCount'
  | 'maxParticipants'
  | 'status'
> & {
  interestId: string;
  isHost: boolean;
  pendingRequestsCount?: number;
  hasReviewed?: boolean;
};

export async function fetchMySquads(userId: string): Promise<MySquadItem[]> {
  if (!userId) return [];

  // 1. Fetch activities hosted by user
  const { data: hosted, error: hostedError } = await supabase
    .from('activities')
    .select(MY_SQUAD_COLUMNS)
    .eq('host_id', userId)
    .order('created_at', { ascending: false });

  if (hostedError) {
    console.warn('fetchMySquads hosted error:', hostedError.message);
  }

  // 2. Fetch activities where user is an accepted member
  const { data: memberships, error: memberError } = await supabase
    .from('activity_members')
    .select('activity_id, is_host')
    .eq('user_id', userId)
    .eq('is_host', false);

  if (memberError) {
    console.warn('fetchMySquads memberships error:', memberError.message);
  }

  type ActivityRow = NonNullable<typeof hosted>[number];
  const memberActivityIds = memberships?.map((m) => m.activity_id) || [];
  let memberActivities: ActivityRow[] = [];
  if (memberActivityIds.length > 0) {
    const { data: acts, error: actsError } = await supabase
      .from('activities')
      .select(MY_SQUAD_COLUMNS)
      .in('id', memberActivityIds);
    if (actsError) {
      console.warn('fetchMySquads member activities error:', actsError.message);
    }
    memberActivities = acts || [];
  }

  // 3. Batch check user ratings to avoid N+1 queries
  const allIds = [...(hosted || []).map((a) => a.id), ...memberActivities.map((a) => a.id)];
  let reviewedSet = new Set<string>();
  if (allIds.length > 0) {
    const { data: userRatings } = await supabase
      .from('ratings')
      .select('activity_id')
      .eq('reviewer_id', userId)
      .in('activity_id', allIds);
    if (userRatings) {
      reviewedSet = new Set(userRatings.map((r) => r.activity_id));
    }
  }

  // 4. Batch-fetch pending join-request counts for every hosted squad in a single
  //    RPC round trip (replaces one COUNT query per hosted activity).
  const hostedIds = (hosted || []).map((a) => a.id);
  const pendingCounts = hostedIds.length > 0
    ? await getPendingRequestCounts(hostedIds)
    : new Map<string, number>();

  // 5. Construct squad items
  const squadList: MySquadItem[] = [];

  if (hosted && hosted.length > 0) {
    const hostedSquads: MySquadItem[] = hosted.map((act) => ({
      id: act.id,
      title: act.title,
      interestId: act.interest_id,
      hostId: act.host_id,
      venueName: act.venue_name,
      expiresAt: act.expires_at,
      currentParticipantsCount: act.current_participants_count,
      maxParticipants: act.max_participants,
      status: act.status,
      isHost: true,
      pendingRequestsCount: pendingCounts.get(act.id) ?? 0,
      hasReviewed: reviewedSet.has(act.id),
    }));
    squadList.push(...hostedSquads);
  }

  for (const act of memberActivities) {
    squadList.push({
      id: act.id,
      title: act.title,
      interestId: act.interest_id,
      hostId: act.host_id,
      venueName: act.venue_name,
      expiresAt: act.expires_at,
      currentParticipantsCount: act.current_participants_count,
      maxParticipants: act.max_participants,
      status: act.status,
      isHost: false,
      hasReviewed: reviewedSet.has(act.id),
    });
  }

  return squadList;
}

export function useMyActivitiesQuery(userId: string | undefined) {
  return useQuery<MySquadItem[]>({
    queryKey: queryKeys.activities.mySquads(userId || ''),
    queryFn: () => fetchMySquads(userId || ''),
    enabled: Boolean(userId),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // Background sync
  });
}
