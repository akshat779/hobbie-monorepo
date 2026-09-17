import { ActivityPublic, ActivityPublicSchema } from '@hobbie/shared';
import { supabase } from './supabase';

/**
 * Fetches the public activity detail projection.
 *
 * The service builds the shared `ActivityPublic` contract and validates it with
 * the shared Zod schema before returning, so the screen can never render an
 * activity whose shape drifted from the domain contract.
 */
export async function fetchActivityDetails(activityId: string): Promise<ActivityPublic | null> {
  const { data: actData, error: actError } = await supabase
    .from('activities')
    .select(
      'id, host_id, interest_id, title, description, tier, venue_name, expires_at, max_participants, current_participants_count, filter_gender, filter_age_min, filter_age_max, status, created_at, image_urls'
    )
    .eq('id', activityId)
    .maybeSingle();

  if (actError || !actData) {
    return null;
  }

  const { data: hostProfile, error: hostError } = await supabase
    .from('profiles')
    .select('name, trust_score, is_verified, avatar_url')
    .eq('id', actData.host_id)
    .maybeSingle();

  if (hostError) {
    throw new Error(hostError.message || 'Failed to load the squad host profile');
  }

  if (!hostProfile) {
    throw new Error('Squad host profile is unavailable for this activity');
  }

  const parsed = ActivityPublicSchema.safeParse({
    id: actData.id,
    hostId: actData.host_id,
    hostName: hostProfile.name,
    hostIsVerified: hostProfile.is_verified,
    hostTrustScore: hostProfile.trust_score,
    hostAvatarUrl: hostProfile.avatar_url,
    interestId: actData.interest_id,
    title: actData.title,
    description: actData.description ?? '',
    tier: actData.tier,
    venueName: actData.venue_name,
    imageUrls: actData.image_urls ?? [],
    createdAt: actData.created_at,
    expiresAt: actData.expires_at,
    maxParticipants: actData.max_participants,
    currentParticipantsCount: actData.current_participants_count,
    status: actData.status,
    filterGender: actData.filter_gender,
    filterAgeMin: actData.filter_age_min,
    filterAgeMax: actData.filter_age_max,
  });

  if (!parsed.success) {
    throw new Error(
      `Activity ${activityId} failed contract validation: ${JSON.stringify(
        parsed.error.flatten()
      )}`
    );
  }

  return parsed.data;
}
