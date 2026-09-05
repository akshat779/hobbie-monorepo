import { supabase } from './supabase';
import { toEwktPoint, fuzzCoordinates } from '@hobbie/shared';
import { DEV_PERSONAS } from '../features/auth/useAuthStore';

/**
 * Spawns 3 realistic test squads within 1-2 km of the caller's actual GPS location.
 * Uses real PostGIS geometries and fresh 2-3 hour TTLs so they render accurately on the radar.
 */
export async function seedNearbySquads(
  userLat: number,
  userLng: number
): Promise<{ count: number; error?: string }> {
  try {
    const host1 = DEV_PERSONAS[0]!; // Alex
    const host2 = DEV_PERSONAS[2]!; // Priya

    const now = new Date();
    const expires1 = new Date(now.getTime() + 2.5 * 60 * 60 * 1000).toISOString();
    const expires2 = new Date(now.getTime() + 1.5 * 60 * 60 * 1000).toISOString();
    const expires3 = new Date(now.getTime() + 45 * 60 * 1000).toISOString();

    const sampleLocations = [
      {
        title: '5-a-side Turf Football Match',
        interestId: 'football',
        lat: userLat + 0.007,
        lng: userLng + 0.006,
        venueName: 'Local Sports Arena Pitch 1',
        description: 'Need 2 more players for casual match. Bibs and balls provided.',
        maxParticipants: 10,
        hostId: host1.id,
        expiresAt: expires1,
      },
      {
        title: 'Badminton Doubles Match',
        interestId: 'badminton',
        lat: userLat - 0.008,
        lng: userLng + 0.005,
        venueName: 'Indoor Smash Arena',
        description: 'Court booked for 1 hour. Need 1 intermediate doubles partner.',
        maxParticipants: 4,
        hostId: host2.id,
        expiresAt: expires2,
      },
      {
        title: 'Filter Coffee & Tech Chat',
        interestId: 'cafe_coffee',
        lat: userLat + 0.004,
        lng: userLng - 0.007,
        venueName: 'Artisan Coffee Roasters',
        description: 'Casual morning coffee & discussing startup ideas.',
        maxParticipants: 4,
        hostId: host1.id,
        expiresAt: expires3,
      },
    ];

    const activitiesToInsert = sampleLocations.map((loc) => {
      const exact = { latitude: loc.lat, longitude: loc.lng };
      const fuzzed = fuzzCoordinates(exact);
      return {
        host_id: loc.hostId,
        interest_id: loc.interestId,
        title: loc.title,
        description: loc.description,
        tier: 'physical' as const,
        location: toEwktPoint(exact),
        fuzzed_location: toEwktPoint(fuzzed),
        venue_name: loc.venueName,
        ttl_hours: 3.0,
        expires_at: loc.expiresAt,
        max_participants: loc.maxParticipants,
        current_participants_count: 2,
        status: 'open' as const,
      };
    });

    const { data, error } = await supabase
      .from('activities')
      .insert(activitiesToInsert)
      .select('id');

    if (error) {
      console.warn('seedNearbySquads error:', error.message);
      return { count: 0, error: error.message };
    }

    return { count: data?.length || 0 };
  } catch (err: any) {
    return { count: 0, error: err?.message || 'Failed to seed squads' };
  }
}
