import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { DEV_PERSONAS } from '../auth/useAuthStore';
import {
  AgeGroupOption,
  DiscoveryQueryParams,
  GenderFilterOption,
  HostProfile,
  NearbyActivity,
} from './types';
import { getTtlStatus } from './utils';

// Fallback seed activities for simulator/dev preview when database has 0 activities
const FALLBACK_DEV_ACTIVITIES: NearbyActivity[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    hostId: '00000000-0000-0000-0000-000000000001',
    hostName: 'Alex Rivera',
    hostTrustScore: 4.95,
    hostIsVerified: true,
    hostAvatarUrl: null,
    interestId: 'football',
    title: '5-a-side Turf Football Match',
    description: 'Need 2 more players for casual match at EcoWorld turf. Bibs provided.',
    tier: 'physical',
    lat: 12.9720,
    lng: 77.5950,
    venueName: 'EcoWorld Turf Club Pitch 2',
    expiresAt: new Date(Date.now() + 145 * 60 * 1000).toISOString(), // ~2h 25m -> fresh
    maxParticipants: 10,
    currentParticipantsCount: 3,
    distanceMeters: 800,
    distanceKm: 0.8,
    ttlStatus: getTtlStatus(new Date(Date.now() + 145 * 60 * 1000)),
    filterGender: 'all',
    filterAgeMin: 18,
    filterAgeMax: 30,
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    hostId: '00000000-0000-0000-0000-000000000003',
    hostName: 'Priya Sharma',
    hostTrustScore: 5.0,
    hostIsVerified: true,
    hostAvatarUrl: null,
    interestId: 'badminton',
    title: 'Badminton Doubles Match',
    description: 'Court booked till 9:30 PM. Need 1 intermediate player.',
    tier: 'physical',
    lat: 12.9805,
    lng: 77.6005,
    venueName: 'Smash Zone Indoor Arena',
    expiresAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(), // 25m -> urgent ember
    maxParticipants: 4,
    currentParticipantsCount: 3,
    distanceMeters: 1400,
    distanceKm: 1.4,
    ttlStatus: getTtlStatus(new Date(Date.now() + 25 * 60 * 1000)),
    filterGender: 'women_only',
    filterAgeMin: 21,
    filterAgeMax: 32,
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    hostId: '00000000-0000-0000-0000-000000000002',
    hostName: 'Sam Chen',
    hostTrustScore: 4.88,
    hostIsVerified: true,
    hostAvatarUrl: null,
    interestId: 'cafe_coffee',
    title: 'Filter Coffee & Tech Chat',
    description: 'Casual morning coffee & discussing startup ideas in Indiranagar.',
    tier: 'physical',
    lat: 12.9650,
    lng: 77.6100,
    venueName: 'Third Wave Coffee Roasters',
    expiresAt: new Date(Date.now() + 50 * 60 * 1000).toISOString(), // 50m -> moderate signal violet
    maxParticipants: 4,
    currentParticipantsCount: 2,
    distanceMeters: 2100,
    distanceKm: 2.1,
    ttlStatus: getTtlStatus(new Date(Date.now() + 50 * 60 * 1000)),
    filterGender: 'coed',
    filterAgeMin: 25,
    filterAgeMax: 45,
  },
];

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
      console.warn('get_nearby_activities RPC error, using fallback:', error.message);
      return filterActivities(FALLBACK_DEV_ACTIVITIES, category, gender, ageGroup);
    }

    if (!rawActivities || rawActivities.length === 0) {
      if (__DEV__) {
        return filterActivities(FALLBACK_DEV_ACTIVITIES, category, gender, ageGroup);
      }
      return [];
    }

    // Extract unique host IDs to fetch host profiles
    const hostIds = Array.from(new Set(rawActivities.map((a) => a.host_id)));

    const { data: hostProfiles } = await supabase
      .from('profiles')
      .select('id, name, trust_score, is_verified, avatar_url')
      .in('id', hostIds);

    const profileMap = new Map<string, HostProfile>();

    // Index DB host profiles
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

    // Fallback to dev personas if any profile is missing
    DEV_PERSONAS.forEach((p) => {
      if (!profileMap.has(p.id)) {
        profileMap.set(p.id, {
          id: p.id,
          name: p.name,
          trustScore: p.trustScore,
          isVerified: p.isVerified,
          avatarUrl: null,
        });
      }
    });

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
    return filterActivities(FALLBACK_DEV_ACTIVITIES, category, gender, ageGroup);
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
