import { z } from 'zod';
import { INTEREST_IDS } from '../constants/interests.js';

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
  filterGender: z
    .enum(['any', 'male-only', 'female-only'])
    .default('any'),
}).superRefine((value, ctx) => {
  if (value.filterAgeMin !== undefined && value.filterAgeMax !== undefined && value.filterAgeMin > value.filterAgeMax) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['filterAgeMax'], message: 'Maximum age must be greater than or equal to minimum age' });
  }
});

export const ActivityPublicSchema = z.object({
  id: z.string().uuid(),
  hostId: z.string().uuid(),
  hostName: z.string(),
  hostIsVerified: z.boolean(),
  hostTrustScore: z.number(),
  interestId: z.enum(INTEREST_IDS),
  title: z.string(),
  description: z.string(),
  tier: z.enum(['physical', 'virtual']),
  fuzzedLocation: CoordinatesSchema,
  exactLocation: CoordinatesSchema.optional(), // Revealed only to accepted members
  venueName: z.string().optional(),
  imageUrls: z.array(z.string().url()).optional().default([]),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  maxParticipants: z.number(),
  currentParticipantsCount: z.number(),
  status: z.enum(['open', 'full', 'in_progress', 'concluded', 'expired']),
  distanceKm: z.number().optional(),
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
// Input keeps defaulted fields optional at call sites; parsing produces the
// fully-defaulted output shape internally.
export type CreateActivityInput = z.input<typeof CreateActivitySchema>;
export type CreateActivityOutput = z.infer<typeof CreateActivitySchema>;
export type ActivityPublic = z.infer<typeof ActivityPublicSchema>;
export type DiscoveryQuery = z.infer<typeof DiscoveryQuerySchema>;
export type LeaveActivityInput = z.infer<typeof LeaveActivitySchema>;
