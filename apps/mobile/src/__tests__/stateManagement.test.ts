import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryKeys } from '../services/queryKeys';
import { filterActivities } from '../features/discovery/useDiscoveryQuery';
import { NearbyActivity } from '../features/discovery/types';
import { useAuthStore } from '../features/auth/useAuthStore';
import { useDiscoveryFiltersStore, DEFAULT_DISCOVERY_FILTERS } from '../features/discovery/useDiscoveryFiltersStore';
import { useLocationStore } from '../features/location/useLocationStore';
import { createContractMockSupabase } from './helpers/contractMocks';

vi.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: vi.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: vi.fn(async () => ({
    coords: { latitude: 12.9716, longitude: 77.5946 },
  })),
  reverseGeocodeAsync: vi.fn(async () => [
    { district: 'Koramangala', city: 'Bengaluru' },
  ]),
  Accuracy: {
    Balanced: 3,
  },
}));

vi.mock('../services/supabase', async () => {
  const { createContractMockSupabase } = await import('./helpers/contractMocks');
  return {
    supabase: createContractMockSupabase(),
  };
});

const mockActivities: NearbyActivity[] = [
  {
    id: 'act-1',
    hostId: 'host-1',
    hostName: 'Host Alpha',
    hostTrustScore: 4.8,
    hostIsVerified: true,
    hostAvatarUrl: null,
    interestId: 'football',
    title: '5v5 Turf Football',
    description: 'Evening match',
    tier: 'physical',
    lat: 12.9716,
    lng: 77.5946,
    venueName: 'Koramangala Turf',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    maxParticipants: 10,
    currentParticipantsCount: 6,
    distanceMeters: 500,
    distanceKm: 0.5,
    ttlStatus: { urgency: 'fresh', formattedTtl: '1h', minutesLeft: 60 },
    filterGender: 'any',
    filterAgeMin: 18,
    filterAgeMax: 35,
  },
  {
    id: 'act-2',
    hostId: 'host-2',
    hostName: 'Host Beta',
    hostTrustScore: 4.9,
    hostIsVerified: false,
    hostAvatarUrl: null,
    interestId: 'badminton',
    title: 'Morning Badminton Doubles',
    description: 'Intermediate players',
    tier: 'physical',
    lat: 12.975,
    lng: 77.6,
    venueName: 'Indiranagar Club',
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
    maxParticipants: 4,
    currentParticipantsCount: 2,
    distanceMeters: 1200,
    distanceKm: 1.2,
    ttlStatus: { urgency: 'moderate', formattedTtl: '30m', minutesLeft: 30 },
    filterGender: 'women_only',
    filterAgeMin: 25,
    filterAgeMax: 40,
  },
  {
    id: 'act-3',
    hostId: 'host-3',
    hostName: 'Host Gamma',
    hostTrustScore: 4.7,
    hostIsVerified: true,
    hostAvatarUrl: null,
    interestId: 'coding_tech',
    title: 'Hackathon Prep & Coworking',
    description: 'Coffee + Code',
    tier: 'physical',
    lat: 12.98,
    lng: 77.61,
    venueName: 'Third Wave Coffee',
    expiresAt: new Date(Date.now() + 7200000).toISOString(),
    maxParticipants: 6,
    currentParticipantsCount: 3,
    distanceMeters: 2500,
    distanceKm: 2.5,
    ttlStatus: { urgency: 'fresh', formattedTtl: '2h', minutesLeft: 120 },
    filterGender: 'men_only',
    filterAgeMin: 18,
    filterAgeMax: 24,
  },
];

describe('State Management & TanStack Query Infrastructure', () => {
  describe('Query Key Factory (queryKeys)', () => {
    it('produces hierarchical, serializable query keys for discovery', () => {
      const allDiscovery = queryKeys.discovery.all();
      expect(allDiscovery).toEqual(['hobbie', 'discovery']);

      const nearbyKey = queryKeys.discovery.nearby(12.9716, 77.5946, 4.5);
      expect(nearbyKey).toEqual(['hobbie', 'discovery', 'nearby', 12.9716, 77.5946, 4.5]);
    });

    it('produces hierarchical query keys for activities domain', () => {
      const allActivities = queryKeys.activities.all();
      expect(allActivities).toEqual(['hobbie', 'activities']);

      const detailKey = queryKeys.activities.detail('act-123');
      expect(detailKey).toEqual(['hobbie', 'activities', 'detail', 'act-123']);

      const mySquadsKey = queryKeys.activities.mySquads('user-456');
      expect(mySquadsKey).toEqual(['hobbie', 'activities', 'mySquads', 'user-456']);

      const joinStatusKey = queryKeys.activities.joinStatus('act-123', 'user-456');
      expect(joinStatusKey).toEqual(['hobbie', 'activities', 'detail', 'act-123', 'joinStatus', 'user-456']);

      const hostRequestsKey = queryKeys.activities.hostRequests('act-123');
      expect(hostRequestsKey).toEqual(['hobbie', 'activities', 'detail', 'act-123', 'hostRequests']);
    });

    it('produces hierarchical query keys for rooms and profiles', () => {
      expect(queryKeys.room.messages('room-1')).toEqual(['hobbie', 'room', 'messages', 'room-1']);
      expect(queryKeys.room.meta('room-1')).toEqual(['hobbie', 'room', 'meta', 'room-1']);
      expect(queryKeys.profile.byId('user-1')).toEqual(['hobbie', 'profile', 'user-1']);
    });
  });

  describe('Discovery select: filterActivities Transformation', () => {
    it('filters by category without refetching RPC data', () => {
      const footballOnly = filterActivities(mockActivities, 'football', 'all', 'all');
      expect(footballOnly).toHaveLength(1);
      expect(footballOnly[0]!.interestId).toBe('football');

      const all = filterActivities(mockActivities, 'all', 'all', 'all');
      expect(all).toHaveLength(3);
    });

    it('filters by gender preference correctly', () => {
      const womenOnly = filterActivities(mockActivities, 'all', 'women_only', 'all');
      expect(womenOnly).toHaveLength(1);
      expect(womenOnly[0]!.id).toBe('act-2');

      const menOnly = filterActivities(mockActivities, 'all', 'men_only', 'all');
      expect(menOnly).toHaveLength(1);
      expect(menOnly[0]!.id).toBe('act-3');
    });

    it('filters by age group criteria correctly', () => {
      // 18_24: min <= 24 && max >= 18
      const youngGroup = filterActivities(mockActivities, 'all', 'all', '18_24');
      // act-1: 18-35 (overlaps 18_24), act-3: 18-24 (matches), act-2: 25-40 (outside)
      expect(youngGroup.map((a) => a.id)).toEqual(['act-1', 'act-3']);

      // 25_34: min <= 34 && max >= 25
      const midGroup = filterActivities(mockActivities, 'all', 'all', '25_34');
      // act-1: 18-35 (overlaps 25_34), act-2: 25-40 (overlaps 25_34), act-3: 18-24 (min 18, max 24 < 25 -> excluded)
      expect(midGroup.map((a) => a.id)).toEqual(['act-1', 'act-2']);
    });

    it('returns empty array when no activities match the combined criteria', () => {
      const none = filterActivities(mockActivities, 'football', 'women_only', 'all');
      expect(none).toHaveLength(0);
    });
  });

  describe('Zustand 5 Store Selectors & Isolation', () => {
    beforeEach(() => {
      useDiscoveryFiltersStore.getState().resetFilters();
    });

    it('preserves atomic selector integrity on useDiscoveryFiltersStore', () => {
      const store = useDiscoveryFiltersStore.getState();
      expect(store.filters).toEqual(DEFAULT_DISCOVERY_FILTERS);

      store.setRadiusKm(10.0);
      expect(useDiscoveryFiltersStore.getState().filters.radiusKm).toBe(10.0);

      store.setGender('women_only');
      expect(useDiscoveryFiltersStore.getState().filters.gender).toBe('women_only');

      store.setAgeGroup('25_34');
      expect(useDiscoveryFiltersStore.getState().filters.ageGroup).toBe('25_34');

      store.resetFilters();
      expect(useDiscoveryFiltersStore.getState().filters).toEqual(DEFAULT_DISCOVERY_FILTERS);
    });

    it('maintains isolated user slice in useAuthStore', () => {
      const user = useAuthStore.getState().user;
      // Active user selector should not throw or leak state
      expect(user === null || typeof user.id === 'string').toBe(true);
    });

    it('manages shared coordinates and city name in useLocationStore', () => {
      const locationState = useLocationStore.getState();
      expect(locationState.coords).toBeDefined();
      expect(typeof locationState.coords.latitude).toBe('number');
      expect(typeof locationState.coords.longitude).toBe('number');
      expect(typeof locationState.cityName).toBe('string');
      expect(typeof locationState.refreshLocation).toBe('function');
    });

    it('persists discovery filter preferences to AsyncStorage', async () => {
      const store = useDiscoveryFiltersStore.getState();
      store.setRadiusKm(8.0);
      store.setGender('men_only');

      expect(useDiscoveryFiltersStore.getState().filters.radiusKm).toBe(8.0);
      expect(useDiscoveryFiltersStore.getState().filters.gender).toBe('men_only');

      // Verify that persist options are configured correctly
      const persistOptions = (useDiscoveryFiltersStore as any).persist;
      expect(persistOptions).toBeDefined();
      expect(persistOptions.getOptions().name).toBe('hobbie-discovery-filters');
    });

    it('persists last-known location coordinates to AsyncStorage', async () => {
      const persistOptions = (useLocationStore as any).persist;
      expect(persistOptions).toBeDefined();
      expect(persistOptions.getOptions().name).toBe('hobbie-last-location');
    });
  });
});
