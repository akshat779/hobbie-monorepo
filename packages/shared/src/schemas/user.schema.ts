import { z } from 'zod';
import { INTEREST_IDS } from '../constants/interests.js';
import { LANGUAGE_CODES, MAX_PREFERRED_LANGUAGES } from '../constants/languages.js';

/** Upper bound for the optional profile bio, mirrored by `check_bio_length`. */
export const BIO_MAX_LENGTH = 160;

export const PhoneAuthSchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Must be a valid E.164 phone number'),
});

export const VerifyOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Must be a valid E.164 phone number'),
  token: z
    .string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d+$/, 'OTP must be digits only'),
});

/** Canonical user gender values, mirrored from the `user_gender` Postgres enum. */
export const USER_GENDERS = ['male', 'female', 'non-binary', 'prefer-not-to-say'] as const;
export const UserGenderSchema = z.enum(USER_GENDERS);

/** Number of profile photos a user may upload (first one is the cover/avatar). */
export const MAX_PROFILE_PHOTOS = 6;

export const UserProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Birth date must be YYYY-MM-DD')
    .refine((val) => {
      const birth = new Date(val);
      const ageDifMs = Date.now() - birth.getTime();
      const ageDate = new Date(ageDifMs);
      const age = Math.abs(ageDate.getUTCFullYear() - 1970);
      return age >= 18;
    }, 'Must be at least 18 years old'),
  gender: UserGenderSchema,
  interests: z
    .array(z.enum(INTEREST_IDS))
    .min(1, 'Select at least one interest')
    .max(5, 'Maximum 5 interests allowed'),
  preferredLanguages: z
    .array(z.enum(LANGUAGE_CODES))
    .min(1, 'Select at least one preferred language')
    .max(MAX_PREFERRED_LANGUAGES, `Select up to ${MAX_PREFERRED_LANGUAGES} languages`)
    .refine(
      (codes) => new Set(codes).size === codes.length,
      'Preferred languages must be unique'
    ),
  bio: z
    .string()
    .trim()
    .max(BIO_MAX_LENGTH, `Bio must be ${BIO_MAX_LENGTH} characters or fewer`)
    .optional(),
  avatarUrl: z.string().url().optional(),
  photoUrls: z
    .array(z.string().url())
    .max(MAX_PROFILE_PHOTOS, `Up to ${MAX_PROFILE_PHOTOS} photos allowed`)
    .refine((urls) => new Set(urls).size === urls.length, 'Photos must be unique')
    .optional(),
});

export const UserSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  gender: UserGenderSchema,
  avatarUrl: z.string().url().nullable().optional(),
  isVerified: z.boolean(),
  trustScore: z.number().min(1).max(5),
  interactionCount: z.number().int().nonnegative(),
});

/**
 * Read-only public profile of another user, assembled from the profile columns
 * the Data API exposes (never phone or location). Used by the join-request
 * review flow so a host can evaluate a requester before accepting.
 */
export const PublicProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Birth date must be YYYY-MM-DD'),
  gender: UserGenderSchema,
  interests: z.array(z.enum(INTEREST_IDS)),
  bio: z.string().nullable(),
  preferredLanguages: z.array(z.enum(LANGUAGE_CODES)),
  avatarUrl: z.string().url().nullable(),
  photoUrls: z.array(z.string().url()),
  isVerified: z.boolean(),
  trustScore: z.number().min(1).max(5),
  interactionCount: z.number().int().nonnegative(),
  ratingsCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});

/** Fuzzed (~100 m) distance between the caller and another user. */
export const FuzzedDistanceSchema = z.object({
  available: z.boolean(),
  distanceM: z.number().int().nonnegative().optional(),
});

export type PhoneAuthInput = z.infer<typeof PhoneAuthSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type UserProfileInput = z.infer<typeof UserProfileSchema>;
export type UserSummary = z.infer<typeof UserSummarySchema>;
export type PublicProfile = z.infer<typeof PublicProfileSchema>;
export type FuzzedDistance = z.infer<typeof FuzzedDistanceSchema>;
