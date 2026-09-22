import { CreateActivityInput, CreateActivitySchema, Database, fuzzCoordinates, toEwktPoint } from '@hobbie/shared';

export type ActivityInsert = Database['public']['Tables']['activities']['Insert'];

/** Pure domain mapping from validated activity input to the Postgres insert DTO. */
export function buildActivityInsert(
  hostId: string,
  input: CreateActivityInput,
  now: Date = new Date(),
): ActivityInsert {
  const parsedResult = CreateActivitySchema.safeParse(input);
  if (!parsedResult.success) {
    throw new Error(parsedResult.error.issues[0]?.message ?? 'Invalid activity details');
  }
  const parsed = parsedResult.data;
  const expiresAt = new Date(now.getTime() + parsed.ttlHours * 60 * 60 * 1000).toISOString();
  return {
    host_id: hostId,
    interest_id: parsed.interestId,
    title: parsed.title.trim(),
    description: parsed.description.trim(),
    tier: parsed.tier,
    location: toEwktPoint(parsed.location),
    fuzzed_location: toEwktPoint(fuzzCoordinates(parsed.location)),
    venue_name: parsed.venueName?.trim() || null,
    ttl_hours: parsed.ttlHours,
    expires_at: expiresAt,
    max_participants: parsed.maxParticipants,
    current_participants_count: 1,
    filter_gender: parsed.filterGender,
    filter_age_min: parsed.filterAgeMin ?? null,
    filter_age_max: parsed.filterAgeMax ?? null,
    status: 'open',
    image_urls: parsed.imageUrls,
  };
}
