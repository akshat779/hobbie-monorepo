import { supabase } from './supabase';

export interface ActivityDetails {
  id: string;
  hostId: string;
  hostName: string;
  hostTrustScore: number | null;
  hostIsVerified: boolean;
  title: string;
  description: string;
  venueName: string | null;
  expiresAt: string;
  maxParticipants: number;
  currentParticipantsCount: number;
  status: string;
}

export async function fetchActivityDetails(activityId: string): Promise<ActivityDetails | null> {
  const { data: actData, error: actError } = await supabase
    .from('activities')
    .select(
      'id, host_id, interest_id, title, description, tier, fuzzed_location, venue_name, expires_at, max_participants, current_participants_count, filter_gender, filter_age_min, filter_age_max, status, created_at, image_urls, ttl_hours'
    )
    .eq('id', activityId)
    .maybeSingle();

  if (actError || !actData) {
    return null;
  }

  const { data: hostProfile } = await supabase
    .from('profiles')
    .select('name, trust_score, is_verified')
    .eq('id', actData.host_id)
    .maybeSingle();

  return {
    id: actData.id,
    hostId: actData.host_id,
    hostName: hostProfile?.name || 'Squad Host',
    hostTrustScore: hostProfile?.trust_score ?? null,
    hostIsVerified: Boolean(hostProfile?.is_verified),
    title: actData.title,
    description: actData.description || '',
    venueName: actData.venue_name,
    expiresAt: actData.expires_at,
    maxParticipants: actData.max_participants,
    currentParticipantsCount: actData.current_participants_count,
    status: actData.status,
  };
}
