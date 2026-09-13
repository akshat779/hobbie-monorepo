import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { queryKeys } from '../../services/queryKeys';
import { getPendingRequestsCount } from '../../services/handshake';

export interface MySquadItem {
  id: string;
  title: string;
  interestId: string;
  hostId: string;
  venueName: string | null;
  expiresAt: string;
  currentParticipantsCount: number;
  maxParticipants: number;
  status: string;
  isHost: boolean;
  pendingRequestsCount?: number;
}

export async function fetchMySquads(userId: string): Promise<MySquadItem[]> {
  if (!userId) return [];

  // 1. Fetch activities hosted by user
  const { data: hosted, error: hostedError } = await supabase
    .from('activities')
    .select('id, host_id, interest_id, title, description, tier, fuzzed_location, venue_name, expires_at, max_participants, current_participants_count, filter_gender, filter_age_min, filter_age_max, status, created_at, image_urls, ttl_hours')
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

  const memberActivityIds = memberships?.map((m) => m.activity_id) || [];
  let memberActivities: any[] = [];
  if (memberActivityIds.length > 0) {
    const { data: acts, error: actsError } = await supabase
      .from('activities')
      .select('id, host_id, interest_id, title, description, tier, fuzzed_location, venue_name, expires_at, max_participants, current_participants_count, filter_gender, filter_age_min, filter_age_max, status, created_at, image_urls, ttl_hours')
      .in('id', memberActivityIds);
    if (actsError) {
      console.warn('fetchMySquads member activities error:', actsError.message);
    }
    memberActivities = acts || [];
  }

  // 3. For hosted activities, count pending requests
  const squadList: MySquadItem[] = [];

  if (hosted && hosted.length > 0) {
    const hostedSquads = await Promise.all(
      hosted.map(async (act) => {
        const pendingCount = await getPendingRequestsCount(act.id);
        return {
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
          pendingRequestsCount: pendingCount,
        };
      })
    );
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
