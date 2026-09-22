import { describe, it, expect } from 'vitest';
import {
  PhoneAuthSchema,
  VerifyOtpSchema,
  UserProfileSchema,
} from '../schemas/user.schema.js';
import { CreateActivitySchema, ActivityPublicSchema } from '../schemas/activity.schema.js';

describe('User Schemas', () => {
  it('validates E.164 phone numbers correctly', () => {
    expect(PhoneAuthSchema.safeParse({ phone: '+14155552671' }).success).toBe(
      true
    );
    expect(PhoneAuthSchema.safeParse({ phone: '14155552671' }).success).toBe(
      false
    );
    expect(PhoneAuthSchema.safeParse({ phone: 'invalid' }).success).toBe(false);
  });

  it('validates 6-digit OTP tokens', () => {
    expect(
      VerifyOtpSchema.safeParse({ phone: '+14155552671', token: '123456' })
        .success
    ).toBe(true);
    expect(
      VerifyOtpSchema.safeParse({ phone: '+14155552671', token: '12345' })
        .success
    ).toBe(false);
    expect(
      VerifyOtpSchema.safeParse({ phone: '+14155552671', token: '12345a' })
        .success
    ).toBe(false);
  });

  it('enforces 18+ age requirement', () => {
    const validAdult = {
      name: 'Alex',
      birthDate: '1995-05-15',
      gender: 'non-binary' as const,
      interests: ['football' as const],
      preferredLanguages: ['en' as const],
    };
    expect(UserProfileSchema.safeParse(validAdult).success).toBe(true);

    const underage = {
      name: 'Youngster',
      birthDate: '2020-01-01',
      gender: 'male' as const,
      interests: ['football' as const],
      preferredLanguages: ['en' as const],
    };
    expect(UserProfileSchema.safeParse(underage).success).toBe(false);
  });

  it('requires 1-3 unique preferred languages drawn from the canonical catalogue', () => {
    const base = {
      name: 'Alex',
      birthDate: '1995-05-15',
      gender: 'non-binary' as const,
      interests: ['football' as const],
    };

    expect(UserProfileSchema.safeParse({ ...base, preferredLanguages: [] }).success).toBe(false);
    expect(
      UserProfileSchema.safeParse({ ...base, preferredLanguages: ['en'] }).success
    ).toBe(true);
    expect(
      UserProfileSchema.safeParse({ ...base, preferredLanguages: ['en', 'hi', 'ta'] }).success
    ).toBe(true);
    expect(
      UserProfileSchema.safeParse({ ...base, preferredLanguages: ['en', 'hi', 'ta', 'bn'] }).success
    ).toBe(false);
    expect(
      UserProfileSchema.safeParse({ ...base, preferredLanguages: ['en', 'en'] }).success
    ).toBe(false);
    expect(
      UserProfileSchema.safeParse({ ...base, preferredLanguages: ['klingon'] }).success
    ).toBe(false);
  });

  it('caps the optional bio at 160 characters', () => {
    const base = {
      name: 'Alex',
      birthDate: '1995-05-15',
      gender: 'non-binary' as const,
      interests: ['football' as const],
      preferredLanguages: ['en' as const],
    };

    expect(UserProfileSchema.safeParse({ ...base, bio: 'a'.repeat(160) }).success).toBe(true);
    expect(UserProfileSchema.safeParse({ ...base, bio: 'a'.repeat(161) }).success).toBe(false);
    expect(UserProfileSchema.safeParse({ ...base }).success).toBe(true);
  });
});

describe('Activity Schemas', () => {
  it('validates activity creation with valid coordinates and interests', () => {
    const validActivity = {
      interestId: 'football' as const,
      title: '5-a-side Turf Football',
      description: 'Need 2 more players for casual match',
      tier: 'physical' as const,
      location: { latitude: 12.9716, longitude: 77.5946 },
      ttlHours: 3,
      maxParticipants: 5,
    };
    expect(CreateActivitySchema.safeParse(validActivity).success).toBe(true);
  });

  it('rejects an inverted age range', () => {
    expect(CreateActivitySchema.safeParse({
      interestId: 'football', title: 'Evening match', location: { latitude: 12, longitude: 77 },
      filterAgeMin: 35, filterAgeMax: 24,
    }).success).toBe(false);
  });

  it('validates ActivityPublicSchema including cancelled status', () => {
    const validCancelled = {
      id: '11111111-1111-1111-1111-111111111111',
      hostId: '22222222-2222-2222-2222-222222222222',
      hostName: 'Host User',
      hostIsVerified: true,
      hostTrustScore: 4.8,
      interestId: 'football' as const,
      title: 'Disbanded game',
      description: 'Host left',
      tier: 'physical' as const,
      fuzzedLocation: { latitude: 12.9716, longitude: 77.5946 },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      maxParticipants: 5,
      currentParticipantsCount: 0,
      status: 'cancelled' as const,
    };
    expect(ActivityPublicSchema.safeParse(validCancelled).success).toBe(true);

    const invalidStatus = { ...validCancelled, status: 'unknown_status' };
    expect(ActivityPublicSchema.safeParse(invalidStatus).success).toBe(false);
  });
});
