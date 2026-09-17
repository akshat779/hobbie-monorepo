import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { queryKeys } from '../../services/queryKeys';
import {
  AgeGroupOption,
  DiscoveryQueryParams,
  GenderFilterOption,
  HostProfile,
  NearbyActivity,
} from './types';
import { getTtlStatus } from './utils';

/**
 * Raw data fetcher: executes the PostGIS RPC and enriches with host profiles.
 * Cached by TanStack Query using coordinates and radius.
 */
export async function fetchRawNearbyActivities(
  userLat: number,
  userLng: number,
  radiusKm: number = 4.5
): Promise<NearbyActivity[]> {
  try {
    // `getSession()` only reads the locally cached token. Validate the token
    // with Auth so an expired/stale local store can never issue an anon RPC.
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return [];

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
        filterGender: act.filter_gender,
        filterAgeMin: act.filter_age_min,
        filterAgeMax: act.filter_age_max,
      };
    });

    return enriched;
  } catch (err) {
    console.warn('fetchNearbyActivities catch error:', err);
    return [];
  }
}

/**
 * Backward-compatible helper for callers/unit tests fetching and filtering directly.
 */
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

  const raw = await fetchRawNearbyActivities(userLat, userLng, radiusKm);
  return filterActivities(raw, category, gender, ageGroup);
}

/**
 * Pure, deterministic in-memory filter function for categories and demographics.
 */
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
      const rawGender = act.filterGender ?? 'all';
      const actGender =
        rawGender === 'male-only'
          ? 'men_only'
          : rawGender === 'female-only'
          ? 'women_only'
          : rawGender;
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

/**
 * Type-safe discovery query hook adhering to TanStack Query best practices:
 * - qk-factory-pattern: Uses `queryKeys.discovery.nearby(lat, lng, radius)`
 * - perf-select-transform: In-memory demographic/category filtering via `select` option
 *   prevents unnecessary RPC re-fetches when switching chips or filter sheets.
 */
export function useDiscoveryQuery(params: DiscoveryQueryParams) {
  const queryEnabled = params.enabled !== false;
  const {
    userLat,
    userLng,
    radiusKm = 4.5,
    category = 'all',
    gender = 'all',
    ageGroup = 'all',
  } = params;

  // Round coordinates to ~100m grid for query cache key to prevent GPS jitter thrashing
  const cacheLat = typeof userLat === 'number' ? Math.round(userLat * 1000) / 1000 : userLat;
  const cacheLng = typeof userLng === 'number' ? Math.round(userLng * 1000) / 1000 : userLng;

  const selectFiltered = useCallback(
    (activities: NearbyActivity[]) =>
      filterActivities(activities, category, gender, ageGroup),
    [category, gender, ageGroup]
  );

  return useQuery<NearbyActivity[], Error, NearbyActivity[]>({
    queryKey: queryKeys.discovery.nearby(cacheLat, cacheLng, radiusKm),
    queryFn: () => fetchRawNearbyActivities(userLat, userLng, radiusKm),
    select: selectFiltered,
    staleTime: 1000 * 60, // 1 minute (Realtime pushes immediate mutations)
    retry: false,
    enabled:
      queryEnabled &&
      typeof userLat === 'number' &&
      typeof userLng === 'number',
  });
}
