import { z } from 'zod';
import { INTEREST_IDS } from '../constants/interests.js';

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
  avatarUrl: z.string().url().optional(),
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

export type PhoneAuthInput = z.infer<typeof PhoneAuthSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type UserProfileInput = z.infer<typeof UserProfileSchema>;
export type UserSummary = z.infer<typeof UserSummarySchema>;
