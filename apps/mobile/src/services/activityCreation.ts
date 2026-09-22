import { CreateActivityInput } from '@hobbie/shared';
import { supabase } from './supabase';
import { buildActivityInsert } from './activityPayload';
export { buildActivityInsert } from './activityPayload';

export async function createActivity(hostId: string, input: CreateActivityInput) {
  if (!hostId) throw new Error('A signed-in host is required to create an activity');
  const insert = buildActivityInsert(hostId, input);
  const { data, error } = await supabase
    .from('activities')
    .insert(insert)
    .select('id, host_id, interest_id, title, description, tier, fuzzed_location, venue_name, expires_at, max_participants, current_participants_count, filter_gender, filter_age_min, filter_age_max, status, created_at, image_urls, ttl_hours')
    .single();
  if (error || !data) throw error ?? new Error('Failed to create activity');
  return data;
}
