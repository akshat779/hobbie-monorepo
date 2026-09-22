import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DiscoveryActivity,
  DiscoveryActivitySchema,
  GenderFilter,
  InterestId,
  NearbyActivityRowsSchema,
} from '@hobbie/shared';
import { supabase } from '../../services/supabase';
import { queryKeys } from '../../services/queryKeys';
import {
  AgeGroupOption,
  DiscoveryDemographicFilters,
  DiscoveryQueryParams,
  GenderFilterOption,
  HostProfile,
} from './types';

/**
 * Maps the database `gender_filter` enum onto the client demographic filter
 * vocabulary. `null` (no restriction) behaves as an unconstrained activity.
 */
function toGenderFilterOption(value: GenderFilter | null): GenderFilterOption {
  switch (value) {
    case 'male-only':
      return 'men_only';
    case 'female-only':
      return 'women_only';
    case 'any':
      return 'coed';
    default:
      return 'all';
  }
}

/**
 * Raw data fetcher: executes the PostGIS RPC, rigorously validates the payload
 * against the shared row contract, then enriches with host profiles.
 *
 * Every runtime shape failure is surfaced through the contract schema instead of
 * being silently blind-cast into a client DTO.
 */
export async function fetchRawNearbyActivities(
  latitude: number,
  longitude: number,
  radiusKm: number = 4.5
): Promise<DiscoveryActivity[]> {
  try {
    // `getSession()` only reads the locally cached token. Validate the token
    // with Auth so an expired/stale local store can never issue an anon RPC.
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return [];

    const { data: rawActivities, error } = await supabase.rpc('get_nearby_activities', {
      user_lat: latitude,
      user_lng: longitude,
      radius_km: radiusKm,
    });

    if (error) {
      console.warn('get_nearby_activities RPC error:', error.message);
      return [];
    }

    const parsedRows = NearbyActivityRowsSchema.safeParse(rawActivities ?? []);
    if (!parsedRows.success) {
      console.warn(
        'get_nearby_activities payload failed contract validation:',
        parsedRows.error.flatten()
      );
      return [];
    }

    if (parsedRows.data.length === 0) {
      return [];
    }

    // Extract unique host IDs to fetch host profiles
    const hostIds = Array.from(new Set(parsedRows.data.map((row) => row.host_id)));

    const { data: hostProfiles } = await supabase
      .from('profiles')
      .select('id, name, trust_score, is_verified, avatar_url')
      .in('id', hostIds);

    const profileMap = new Map<string, HostProfile>();
    for (const profile of hostProfiles ?? []) {
      profileMap.set(profile.id, {
        id: profile.id,
        name: profile.name,
        trustScore: profile.trust_score,
        isVerified: profile.is_verified,
        avatarUrl: profile.avatar_url,
      });
    }

    const enriched: DiscoveryActivity[] = [];

    for (const row of parsedRows.data) {
      const host = profileMap.get(row.host_id);
      if (!host) {
        // A missing host profile means a broken activity → profile link. Skip
        // rather than fabricate a trust score the database never asserted.
        console.warn(
          `Discovery skipped activity ${row.id}: host profile ${row.host_id} unavailable`
        );
        continue;
      }

      const validated = DiscoveryActivitySchema.safeParse({
        id: row.id,
        hostId: row.host_id,
        hostName: host.name,
        hostAvatarUrl: host.avatarUrl ?? null,
        hostTrustScore: host.trustScore,
        hostIsVerified: host.isVerified,
        interestId: row.interest_id,
        title: row.title,
        description: row.description ?? '',
        tier: row.tier,
        fuzzedLocation: { latitude: row.lat, longitude: row.lng },
        venueName: row.venue_name,
        imageUrls: row.image_urls ?? [],
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        maxParticipants: row.max_participants,
        currentParticipantsCount: row.current_participants_count,
        status: row.status,
        distanceMeters: row.distance_meters,
        distanceKm: Math.round((row.distance_meters / 1000) * 10) / 10,
        filterGender: row.filter_gender,
        filterAgeMin: row.filter_age_min,
        filterAgeMax: row.filter_age_max,
      });

      if (!validated.success) {
        console.warn(
          `Discovery skipped activity ${row.id}: enriched payload failed contract validation:`,
          validated.error.flatten()
        );
        continue;
      }

      enriched.push(validated.data);
    }

    return enriched;
  } catch (err) {
    console.warn('fetchNearbyActivities catch error:', err);
    return [];
  }
}

/**
 * Convenience helper for callers/unit tests fetching and filtering directly.
 */
export async function fetchNearbyActivities(
  params: DiscoveryQueryParams,
  filters: DiscoveryDemographicFilters = {}
): Promise<DiscoveryActivity[]> {
  const { latitude, longitude, radiusKm = 4.5, interestIds } = params;

  const raw = await fetchRawNearbyActivities(latitude, longitude, radiusKm);
  return filterActivities(raw, interestIds, filters.gender ?? 'all', filters.ageGroup ?? 'all');
}

/**
 * Pure, deterministic in-memory filter function for the interest taxonomy and
 * demographic chips. Interest matching is array-based (`InterestId[]`).
 */
export function filterActivities(
  activities: DiscoveryActivity[],
  interestIds?: InterestId[],
  gender: GenderFilterOption = 'all',
  ageGroup: AgeGroupOption = 'all'
): DiscoveryActivity[] {
  const activeInterests =
    interestIds && interestIds.length > 0 ? new Set<InterestId>(interestIds) : null;

  return activities.filter((act) => {
    // 1. Interest taxonomy Filter
    if (activeInterests && !activeInterests.has(act.interestId)) {
      return false;
    }

    // 2. Gender Target Filter
    if (gender !== 'all') {
      const actGender = toGenderFilterOption(act.filterGender ?? null);
      if (actGender !== 'all' && actGender !== gender) {
        return false;
      }
    }

    // 3. Age Group Filter
    if (ageGroup !== 'all') {
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
 * - perf-select-transform: In-memory demographic/interest filtering via `select`
 *   prevents unnecessary RPC re-fetches when switching chips or filter sheets.
 */
export function useDiscoveryQuery(
  params: DiscoveryQueryParams,
  filters: DiscoveryDemographicFilters = {}
) {
  const queryEnabled = params.enabled !== false;
  const { latitude, longitude, radiusKm = 4.5, interestIds } = params;
  const gender = filters.gender ?? 'all';
  const ageGroup = filters.ageGroup ?? 'all';

  // Round coordinates to ~100m grid for query cache key to prevent GPS jitter thrashing
  const cacheLat = typeof latitude === 'number' ? Math.round(latitude * 1000) / 1000 : latitude;
  const cacheLng = typeof longitude === 'number' ? Math.round(longitude * 1000) / 1000 : longitude;

  const selectFiltered = useCallback(
    (activities: DiscoveryActivity[]) =>
      filterActivities(activities, interestIds, gender, ageGroup),
    [interestIds, gender, ageGroup]
  );

  return useQuery<DiscoveryActivity[], Error, DiscoveryActivity[]>({
    queryKey: queryKeys.discovery.nearby(cacheLat, cacheLng, radiusKm),
    queryFn: () => fetchRawNearbyActivities(latitude, longitude, radiusKm),
    select: selectFiltered,
    staleTime: 1000 * 60, // 1 minute (Realtime pushes immediate mutations)
    retry: false,
    enabled:
      queryEnabled &&
      typeof latitude === 'number' &&
      typeof longitude === 'number',
  });
}
