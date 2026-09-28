import {
  FuzzedDistanceSchema,
  PublicProfileSchema,
  type FuzzedDistance,
  type PublicProfile,
} from '@hobbie/shared';
import { supabase } from './supabase';

/**
 * Columns exposed by the Data API for another user's public profile. Mirrors
 * the column grants in 20260906071836 / 20260922000001 / 20260927000000 — no
 * phone, no location.
 */
const PUBLIC_PROFILE_COLUMNS =
  'id, name, birth_date, gender, interests, bio, preferred_languages, avatar_url, photo_urls, is_verified, trust_score, interaction_count, ratings_count, created_at';

/**
 * Fetches a read-only public profile for the given user id, validated against
 * `PublicProfileSchema`. Returns `null` when unavailable or malformed.
 */
export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      if (error) console.warn('fetchPublicProfile error:', error.message);
      return null;
    }

    const parsed = PublicProfileSchema.safeParse({
      id: data.id,
      name: data.name,
      birthDate: data.birth_date,
      gender: data.gender,
      interests: data.interests,
      bio: data.bio,
      preferredLanguages: data.preferred_languages,
      avatarUrl: data.avatar_url,
      photoUrls: data.photo_urls ?? [],
      isVerified: data.is_verified,
      trustScore: data.trust_score,
      interactionCount: data.interaction_count,
      ratingsCount: data.ratings_count,
      createdAt: data.created_at,
    });

    if (!parsed.success) {
      console.warn(
        'fetchPublicProfile payload failed contract validation:',
        parsed.error.flatten()
      );
      return null;
    }

    return parsed.data;
  } catch (err) {
    console.warn('fetchPublicProfile query error:', err);
    return null;
  }
}

/**
 * Fuzzed (~100 m) distance between the caller and another user. Returns
 * `{ available: false }` when either party has no recorded location.
 */
export async function getFuzzedDistance(userId: string): Promise<FuzzedDistance> {
  if (!userId) return { available: false };

  try {
    const { data, error } = await supabase.rpc('get_fuzzed_distance', {
      p_target_user_id: userId,
    });
    if (error) return { available: false };

    const payload = (data ?? {}) as { available?: unknown; distance_m?: unknown };
    const parsed = FuzzedDistanceSchema.safeParse({
      available: payload.available,
      distanceM: payload.distance_m,
    });
    return parsed.success ? parsed.data : { available: false };
  } catch (err) {
    console.warn('getFuzzedDistance error:', err);
    return { available: false };
  }
}
