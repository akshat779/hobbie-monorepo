import { supabase } from './supabase';
import { toEwktPoint, fuzzCoordinates } from '@hobbie/shared';

interface SeedSquadSpec {
  title: string;
  interestId: string;
  lat: number;
  lng: number;
  venueName: string;
  description: string;
  maxParticipants: number;
  expiresAt: string;
}

/**
 * Spawns 3 realistic test squads within 1-2 km of the caller's actual GPS location.
 * Uses real PostGIS geometries and fresh 2-3 hour TTLs so they render accurately on the radar.
 *
 * RLS note: the `activities` insert policy strictly enforces
 * `WITH CHECK (auth.uid() = host_id)`. The previous implementation hardcoded
 * `DEV_PERSONAS[*].id` as the host, which can never match the authenticated
 * session (dev login provisions auth users with generated UUIDs), so every
 * insert was rejected. Every generated squad is therefore attributed to the
 * active authenticated session instead of a detached mock identity.
 */
export async function seedNearbySquads(
  userLat: number,
  userLng: number
): Promise<{ count: number; error?: string }> {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return { count: 0, error: 'You must be signed in to seed demo squads' };
    }
    const seedingHostId = authData.user.id;

    const now = new Date();
    const expires1 = new Date(now.getTime() + 2.5 * 60 * 60 * 1000).toISOString();
    const expires2 = new Date(now.getTime() + 1.5 * 60 * 60 * 1000).toISOString();
    const expires3 = new Date(now.getTime() + 45 * 60 * 1000).toISOString();

    const sampleLocations: SeedSquadSpec[] = [
      {
        title: '5-a-side Turf Football Match',
        interestId: 'football',
        lat: userLat + 0.007,
        lng: userLng + 0.006,
        venueName: 'Local Sports Arena Pitch 1',
        description: 'Need 2 more players for casual match. Bibs and balls provided.',
        maxParticipants: 10,
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
        expiresAt: expires3,
      },
    ];

    const activitiesToInsert = sampleLocations.map((loc) => {
      const exact = { latitude: loc.lat, longitude: loc.lng };
      const fuzzed = fuzzCoordinates(exact);
      return {
        host_id: seedingHostId,
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
        current_participants_count: 1,
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
  } catch (err) {
    return {
      count: 0,
      error: err instanceof Error ? err.message : 'Failed to seed squads',
    };
  }
}
