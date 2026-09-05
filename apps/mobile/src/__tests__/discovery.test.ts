import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getTtlStatus,
  getPinTheme,
  formatDistance,
  calculateDistanceKm,
} from '../features/discovery/utils';
import {
  fetchNearbyActivities,
  filterActivities,
} from '../features/discovery/useDiscoveryQuery';
import { NearbyActivity } from '../features/discovery/types';
import { supabase } from '../services/supabase';

vi.mock('../services/supabase', () => {
  const mockSelect = vi.fn();
  const mockIn = vi.fn();

  const queryBuilder = {
    select: mockSelect.mockReturnThis(),
    in: mockIn,
  };

  const mockFrom = vi.fn(() => queryBuilder);
  const mockRpc = vi.fn();

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
    },
  };
});

describe('Discovery Utilities', () => {
  describe('getTtlStatus', () => {
    const baseNow = new Date('2026-09-01T12:00:00.000Z');

    it('should classify >60m left as fresh with hours and minutes formatted', () => {
      const expiresAt = new Date('2026-09-01T14:25:00.000Z');
      const status = getTtlStatus(expiresAt, baseNow);

      expect(status.urgency).toBe('fresh');
      expect(status.minutesLeft).toBe(145);
      expect(status.formattedTtl).toBe('2h 25m');
    });

    it('should format clean hours when minutes remainder is 0', () => {
      const expiresAt = new Date('2026-09-01T14:00:00.000Z');
      const status = getTtlStatus(expiresAt, baseNow);

      expect(status.urgency).toBe('fresh');
      expect(status.minutesLeft).toBe(120);
      expect(status.formattedTtl).toBe('2h');
    });

    it('should classify 30-60m left as moderate', () => {
      const expiresAt = new Date('2026-09-01T12:45:00.000Z');
      const status = getTtlStatus(expiresAt, baseNow);

      expect(status.urgency).toBe('moderate');
      expect(status.minutesLeft).toBe(45);
      expect(status.formattedTtl).toBe('45m');
    });

    it('should classify <30m left as expiring urgency (Ember state)', () => {
      const expiresAt = new Date('2026-09-01T12:25:00.000Z');
      const status = getTtlStatus(expiresAt, baseNow);

      expect(status.urgency).toBe('expiring');
      expect(status.minutesLeft).toBe(25);
      expect(status.formattedTtl).toBe('25m');
    });

    it('should classify past expiry as expired', () => {
      const expiresAt = new Date('2026-09-01T11:55:00.000Z');
      const status = getTtlStatus(expiresAt, baseNow);

      expect(status.urgency).toBe('expired');
      expect(status.minutesLeft).toBe(0);
      expect(status.formattedTtl).toBe('Expired');
    });
  });

  describe('getPinTheme', () => {
    it('should return pulse-lilac palette for fresh urgency', () => {
      const theme = getPinTheme('fresh');
      expect(theme.primary).toBe('#C77DFF');
      expect(theme.badgeText).toBe('#C77DFF');
      expect(theme.pulseSpeedMs).toBe(2400);
    });

    it('should return signal-violet palette for moderate urgency', () => {
      const theme = getPinTheme('moderate');
      expect(theme.primary).toBe('#7B2FF7');
      expect(theme.badgeText).toBe('#D2BBFF');
      expect(theme.pulseSpeedMs).toBe(2000);
    });

    it('should return ember palette with rapid pulse for expiring urgency', () => {
      const theme = getPinTheme('expiring');
      expect(theme.primary).toBe('#FF6B5E');
      expect(theme.badgeText).toBe('#FF6B5E');
      expect(theme.pulseSpeedMs).toBe(1000);
    });

    it('should return muted static palette for expired urgency', () => {
      const theme = getPinTheme('expired');
      expect(theme.primary).toBe('#5A536B');
      expect(theme.pulseSpeedMs).toBe(0);
    });
  });

  describe('formatDistance', () => {
    it('should format distances under 1000 meters in meters', () => {
      expect(formatDistance(800)).toBe('800m away');
      expect(formatDistance(250.4)).toBe('250m away');
    });

    it('should format distances over 1000 meters in kilometers', () => {
      expect(formatDistance(1400)).toBe('1.4 km away');
      expect(formatDistance(4500)).toBe('4.5 km away');
    });
  });

  describe('calculateDistanceKm', () => {
    it('should return 0 km for identical coordinates', () => {
      const dist = calculateDistanceKm(12.9716, 77.5946, 12.9716, 77.5946);
      expect(dist).toBe(0);
    });

    it('should calculate Haversine distance between Bangalore coordinates', () => {
      const dist = calculateDistanceKm(12.9716, 77.5946, 12.9784, 77.6408);
      expect(dist).toBeGreaterThan(4);
      expect(dist).toBeLessThan(6);
    });
  });

  describe('Multi-Facet Filtering (Category, Gender, Age Group)', () => {
    const mockActivities: NearbyActivity[] = [
      {
        id: '1',
        hostId: 'h1',
        hostName: 'Alex',
        hostTrustScore: 4.9,
        hostIsVerified: true,
        interestId: 'football',
        title: 'Men Football',
        description: '',
        tier: 'physical',
        lat: 12.97,
        lng: 77.59,
        expiresAt: new Date().toISOString(),
        maxParticipants: 10,
        currentParticipantsCount: 4,
        distanceMeters: 500,
        distanceKm: 0.5,
        ttlStatus: { minutesLeft: 90, formattedTtl: '1h 30m', urgency: 'fresh' },
        filterGender: 'men_only',
        filterAgeMin: 18,
        filterAgeMax: 24,
      },
      {
        id: '2',
        hostId: 'h2',
        hostName: 'Priya',
        hostTrustScore: 5.0,
        hostIsVerified: true,
        interestId: 'badminton',
        title: 'Women Badminton',
        description: '',
        tier: 'physical',
        lat: 12.98,
        lng: 77.60,
        expiresAt: new Date().toISOString(),
        maxParticipants: 4,
        currentParticipantsCount: 2,
        distanceMeters: 1200,
        distanceKm: 1.2,
        ttlStatus: { minutesLeft: 20, formattedTtl: '20m', urgency: 'expiring' },
        filterGender: 'women_only',
        filterAgeMin: 22,
        filterAgeMax: 30,
      },
      {
        id: '3',
        hostId: 'h3',
        hostName: 'Senior Host',
        hostTrustScore: 4.8,
        hostIsVerified: false,
        interestId: 'board_games',
        title: 'Chess Meet',
        description: '',
        tier: 'physical',
        lat: 12.96,
        lng: 77.61,
        expiresAt: new Date().toISOString(),
        maxParticipants: 6,
        currentParticipantsCount: 2,
        distanceMeters: 2000,
        distanceKm: 2.0,
        ttlStatus: { minutesLeft: 40, formattedTtl: '40m', urgency: 'moderate' },
        filterGender: 'coed',
        filterAgeMin: 35,
        filterAgeMax: 60,
      },
    ];

    it('should filter activities by gender preference', () => {
      const womenOnly = filterActivities(mockActivities, 'all', 'women_only', 'all');
      expect(womenOnly.length).toBe(1);
      expect(womenOnly[0]?.id).toBe('2');

      const allGenders = filterActivities(mockActivities, 'all', 'all', 'all');
      expect(allGenders.length).toBe(3);
    });

    it('should filter activities by demographic age group', () => {
      const collegeAge = filterActivities(mockActivities, 'all', 'all', '18_24');
      // Matches football (18-24) and badminton (22-30)
      expect(collegeAge.length).toBe(2);

      const matureGroup = filterActivities(mockActivities, 'all', 'all', '35_plus');
      // Matches chess meet (35-60)
      expect(matureGroup.length).toBe(1);
      expect(matureGroup[0]?.id).toBe('3');
    });

    it('should combine category, gender, and age filters seamlessly', () => {
      const combined = filterActivities(
        mockActivities,
        'badminton',
        'women_only',
        '25_34'
      );
      expect(combined.length).toBe(1);
      expect(combined[0]?.title).toBe('Women Badminton');
    });
  });

  describe('fetchNearbyActivities', () => {
    const mockRpcActivities = [
      {
        id: 'act-1',
        host_id: 'host-1',
        interest_id: 'football',
        title: 'Turf Football 5v5',
        description: 'Friendly match',
        tier: 'physical',
        lat: 12.9716,
        lng: 77.5946,
        venue_name: 'Turf Arena',
        expires_at: new Date(Date.now() + 7200000).toISOString(),
        max_participants: 10,
        current_participants_count: 6,
        distance_meters: 650,
      },
      {
        id: 'act-2',
        host_id: 'host-2',
        interest_id: 'badminton',
        title: 'Badminton Doubles',
        description: 'Need 2 more',
        tier: 'physical',
        lat: 12.978,
        lng: 77.599,
        venue_name: 'Smash Zone',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        max_participants: 4,
        current_participants_count: 2,
        distance_meters: 1200,
      },
    ];

    const mockProfiles = [
      {
        id: 'host-1',
        name: 'Alex Rivera',
        trust_score: 4.95,
        is_verified: true,
        avatar_url: null,
      },
      {
        id: 'host-2',
        name: 'Sam Chen',
        trust_score: 4.88,
        is_verified: true,
        avatar_url: null,
      },
    ];

    beforeEach(() => {
      vi.clearAllMocks();
      (supabase.rpc as any).mockResolvedValue({
        data: mockRpcActivities,
        error: null,
      });
      const qb = (supabase.from as any)('profiles');
      qb.in.mockResolvedValue({
        data: mockProfiles,
        error: null,
      });
    });

    it('should call get_nearby_activities RPC and enrich with host profiles', async () => {
      const allActivities = await fetchNearbyActivities({
        userLat: 12.9716,
        userLng: 77.5946,
        radiusKm: 4.5,
        category: 'all',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('get_nearby_activities', {
        user_lat: 12.9716,
        user_lng: 77.5946,
        radius_km: 4.5,
      });
      expect(allActivities.length).toBe(2);
      expect(allActivities[0]?.hostName).toBe('Alex Rivera');
      expect(allActivities[0]?.hostTrustScore).toBe(4.95);
      expect(allActivities[0]?.ttlStatus.urgency).toBe('fresh');
    });

    it('should filter RPC activities by category', async () => {
      const footballOnly = await fetchNearbyActivities({
        userLat: 12.9716,
        userLng: 77.5946,
        radiusKm: 4.5,
        category: 'football',
      });

      expect(footballOnly.length).toBe(1);
      expect(footballOnly[0]?.interestId).toBe('football');
      expect(footballOnly[0]?.hostTrustScore).toBeGreaterThanOrEqual(4.5);
    });

    it('should return empty array when RPC errors or finds no squads', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
      });

      const activities = await fetchNearbyActivities({
        userLat: 12.9716,
        userLng: 77.5946,
        radiusKm: 4.5,
      });

      expect(activities).toEqual([]);
    });
  });
});
