import { z } from 'zod';
import { INTEREST_IDS } from '../constants/interests.js';

/** Canonical interest taxonomy identifier (single source of truth). */
export const InterestIdSchema = z.enum(INTEREST_IDS);

/** Canonical activity lifecycle statuses, mirrored from the `activity_status` Postgres enum. */
export const ACTIVITY_STATUSES = [
  'open',
  'full',
  'in_progress',
  'concluded',
  'expired',
  'cancelled',
] as const;
export const ActivityStatusSchema = z.enum(ACTIVITY_STATUSES);

/** Canonical activity delivery tiers. */
export const ACTIVITY_TIERS = ['physical', 'virtual'] as const;
export const ActivityTierSchema = z.enum(ACTIVITY_TIERS);

/** Canonical host gender-targeting filters, mirrored from the `gender_filter` Postgres enum. */
export const GENDER_FILTERS = ['any', 'male-only', 'female-only'] as const;
export const GenderFilterSchema = z.enum(GENDER_FILTERS);

export const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const CreateActivitySchema = z.object({
  interestId: z.enum(INTEREST_IDS),
  title: z.string().min(3, 'Title must be at least 3 characters').max(60),
  description: z.string().max(300).optional().default(''),
  tier: z.enum(['physical', 'virtual']).default('physical'),
  location: CoordinatesSchema,
  venueName: z.string().max(100).optional(),
  imageUrls: z.array(z.string().url()).optional().default([]),
  ttlHours: z.number().min(1).max(4).default(3),
  maxParticipants: z.number().int().min(2).max(20).default(5),
  filterAgeMin: z.number().int().min(18).max(99).optional(),
  filterAgeMax: z.number().int().min(18).max(99).optional(),
  filterGender: GenderFilterSchema.default('any'),
}).superRefine((value, ctx) => {
  if (value.filterAgeMin !== undefined && value.filterAgeMax !== undefined && value.filterAgeMin > value.filterAgeMax) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['filterAgeMax'], message: 'Maximum age must be greater than or equal to minimum age' });
  }
});

/**
 * Public activity DTO delivered to clients. This is the canonical shape produced by
 * the discovery feed, the activity detail service, and the my-squads projection.
 *
 * `fuzzedLocation` is optional because non-map surfaces (detail, my-squads) never
 * receive the PostGIS-backed public coordinate; map surfaces must supply it.
 */
export const ActivityPublicSchema = z.object({
  id: z.string().uuid(),
  hostId: z.string().uuid(),
  hostName: z.string(),
  hostIsVerified: z.boolean(),
  hostTrustScore: z.number(),
  hostAvatarUrl: z.string().url().nullable().optional(),
  interestId: InterestIdSchema,
  title: z.string(),
  description: z.string(),
  tier: ActivityTierSchema,
  fuzzedLocation: CoordinatesSchema.optional(),
  exactLocation: CoordinatesSchema.optional(), // Revealed only to accepted members
  venueName: z.string().nullable().optional(),
  imageUrls: z
    .array(z.string().url())
    .nullish()
    .transform((value) => value ?? []),
  createdAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  maxParticipants: z.number(),
  currentParticipantsCount: z.number(),
  status: ActivityStatusSchema,
  distanceMeters: z.number().nonnegative().optional(),
  distanceKm: z.number().nonnegative().optional(),
  filterGender: GenderFilterSchema.nullable().optional(),
  filterAgeMin: z.number().int().nullable().optional(),
  filterAgeMax: z.number().int().nullable().optional(),
});

/**
 * Raw row contract returned by the `get_nearby_activities` PostGIS RPC.
 * Parsed before the discovery client maps/enriches into `DiscoveryActivity`.
 */
export const NearbyActivityRowSchema = z.object({
  id: z.string().uuid(),
  host_id: z.string().uuid(),
  interest_id: InterestIdSchema,
  title: z.string(),
  description: z.string().nullable(),
  tier: ActivityTierSchema,
  lat: z.number(),
  lng: z.number(),
  venue_name: z.string().nullable(),
  filter_gender: GenderFilterSchema.nullable(),
  filter_age_min: z.number().int().nullable(),
  filter_age_max: z.number().int().nullable(),
  expires_at: z.string(),
  max_participants: z.number().int(),
  current_participants_count: z.number().int(),
  distance_meters: z.number(),
  created_at: z.string(),
  status: ActivityStatusSchema,
  image_urls: z.array(z.string()).nullable(),
});

export const NearbyActivityRowsSchema = z.array(NearbyActivityRowSchema);

/**
 * Discovery projection of `ActivityPublic`. The map/radar guarantees a public
 * coordinate and a computed distance, which the base activity DTO leaves optional.
 */
export const DiscoveryActivitySchema = ActivityPublicSchema.extend({
  fuzzedLocation: CoordinatesSchema,
  distanceMeters: z.number().nonnegative(),
  distanceKm: z.number().nonnegative(),
});

export const DiscoveryQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.5).max(20).default(4.5),
  interestIds: z
    .union([z.array(z.enum(INTEREST_IDS)), z.enum(INTEREST_IDS)])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),
});

export const LeaveActivitySchema = z.object({
  activityId: z.string().uuid(),
});

export type Coordinates = z.infer<typeof CoordinatesSchema>;
export type GenderFilter = z.infer<typeof GenderFilterSchema>;
// Input keeps defaulted fields optional at call sites; parsing produces the
// fully-defaulted output shape internally.
export type CreateActivityInput = z.input<typeof CreateActivitySchema>;
export type CreateActivityOutput = z.infer<typeof CreateActivitySchema>;
export type ActivityPublic = z.infer<typeof ActivityPublicSchema>;
export type NearbyActivityRow = z.infer<typeof NearbyActivityRowSchema>;
export type DiscoveryActivity = z.infer<typeof DiscoveryActivitySchema>;
export type DiscoveryQuery = z.infer<typeof DiscoveryQuerySchema>;
export type LeaveActivityInput = z.infer<typeof LeaveActivitySchema>;
