import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import {
  AgeGroupOption,
  DiscoveryQueryParams,
  GenderFilterOption,
  HostProfile,
  NearbyActivity,
} from './types';
import { getTtlStatus } from './utils';

export async function fetchNearbyActivities(
  params: DiscoveryQueryParams
): Promise<NearbyActivity[]> {
  const {
    userLat,
    userLng,
    radiusKm = 4.5,
    category,
    gender = 'all',
    ageGroup = 'all',
  } = params;

  try {
    const { data: rawActivities, error } = await supabase.rpc(
      'get_nearby_activities',
      {
        user_lat: userLat,
        user_lng: userLng,
        radius_km: radiusKm,
      }
    );

    if (error) {
      console.warn('get_nearby_activities RPC error:', error.message);
      return [];
    }

    if (!rawActivities || rawActivities.length === 0) {
      return [];
    }

    // Extract unique host IDs to fetch host profiles
    const hostIds = Array.from(new Set(rawActivities.map((a) => a.host_id)));

    const { data: hostProfiles } = await supabase
      .from('profiles')
      .select('id, name, trust_score, is_verified, avatar_url')
      .in('id', hostIds);

    const profileMap = new Map<string, HostProfile>();

    if (hostProfiles) {
      hostProfiles.forEach((p) => {
        profileMap.set(p.id, {
          id: p.id,
          name: p.name,
          trustScore: p.trust_score,
          isVerified: p.is_verified,
          avatarUrl: p.avatar_url,
        });
      });
    }

    const enriched: NearbyActivity[] = rawActivities.map((act) => {
      const host = profileMap.get(act.host_id);
      const ttlStatus = getTtlStatus(act.expires_at);

      return {
        id: act.id,
        hostId: act.host_id,
        hostName: host?.name || 'Hobbie Host',
        hostTrustScore: host?.trustScore ?? 5.0,
        hostIsVerified: host?.isVerified ?? false,
        hostAvatarUrl: host?.avatarUrl ?? null,
        interestId: act.interest_id,
        title: act.title,
        description: act.description || '',
        tier: act.tier || 'physical',
        lat: act.lat,
        lng: act.lng,
        venueName: act.venue_name,
        expiresAt: act.expires_at,
        maxParticipants: act.max_participants,
        currentParticipantsCount: act.current_participants_count,
        distanceMeters: act.distance_meters,
        distanceKm: Math.round((act.distance_meters / 1000) * 10) / 10,
        ttlStatus,
      };
    });

    return filterActivities(enriched, category, gender, ageGroup);
  } catch (err) {
    console.warn('fetchNearbyActivities catch error:', err);
    return [];
  }
}

export function filterActivities(
  activities: NearbyActivity[],
  category?: string,
  gender?: GenderFilterOption,
  ageGroup?: AgeGroupOption
): NearbyActivity[] {
  return activities.filter((act) => {
    // 1. Category Filter
    if (category && category !== 'all' && act.interestId !== category) {
      return false;
    }

    // 2. Gender Target Filter
    if (gender && gender !== 'all') {
      const actGender = act.filterGender ?? 'all';
      if (actGender !== 'all' && actGender !== gender) {
        return false;
      }
    }

    // 3. Age Group Filter
    if (ageGroup && ageGroup !== 'all') {
      const min = act.filterAgeMin ?? 18;
      const max = act.filterAgeMax ?? 99;

      if (ageGroup === '18_24') {
        if (min > 24 || max < 18) return false;
      } else if (ageGroup === '25_34') {
        if (min > 34 || max < 25) return false;
      } else if (ageGroup === '35_plus') {
        if (max < 35 || min > 65) return false;
      }
    }

    return true;
  });
}

export function useDiscoveryQuery(params: DiscoveryQueryParams) {
  const {
    userLat,
    userLng,
    radiusKm = 4.5,
    category = 'all',
    gender = 'all',
    ageGroup = 'all',
  } = params;

  return useQuery<NearbyActivity[]>({
    queryKey: [
      'discovery',
      'nearby_activities',
      userLat,
      userLng,
      radiusKm,
      category,
      gender,
      ageGroup,
    ],
    queryFn: () =>
      fetchNearbyActivities({
        userLat,
        userLng,
        radiusKm,
        category,
        gender,
        ageGroup,
      }),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // Auto sync live pin feed every 30s
    enabled: typeof userLat === 'number' && typeof userLng === 'number',
  });
}
