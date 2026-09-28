import { describe, it, expect } from 'vitest';
import {
  PhoneAuthSchema,
  VerifyOtpSchema,
  UserProfileSchema,
  PublicProfileSchema,
  FuzzedDistanceSchema,
  MAX_PROFILE_PHOTOS,
} from '../schemas/user.schema.js';
import { BlockActionResultSchema, REPORT_REASONS } from '../schemas/moderation.schema.js';
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

  it('accepts up to six unique photo URLs and rejects more or duplicates', () => {
    const base = {
      name: 'Alex',
      birthDate: '1995-05-15',
      gender: 'non-binary' as const,
      interests: ['football' as const],
      preferredLanguages: ['en' as const],
    };
    const url = (n: number) => `https://cdn.example.com/photo-${n}.jpg`;

    expect(UserProfileSchema.safeParse({ ...base }).success).toBe(true);
    expect(
      UserProfileSchema.safeParse({ ...base, photoUrls: [url(1), url(2)] }).success
    ).toBe(true);
    expect(
      UserProfileSchema.safeParse({
        ...base,
        photoUrls: Array.from({ length: MAX_PROFILE_PHOTOS }, (_, i) => url(i)),
      }).success
    ).toBe(true);
    expect(
      UserProfileSchema.safeParse({
        ...base,
        photoUrls: Array.from({ length: MAX_PROFILE_PHOTOS + 1 }, (_, i) => url(i)),
      }).success
    ).toBe(false);
    expect(
      UserProfileSchema.safeParse({ ...base, photoUrls: [url(1), url(1)] }).success
    ).toBe(false);
    expect(
      UserProfileSchema.safeParse({ ...base, photoUrls: ['not-a-url'] }).success
    ).toBe(false);
  });
});

describe('Public Profile & Moderation Schemas', () => {
  const publicProfile = {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Sam Chen',
    birthDate: '2000-08-22',
    gender: 'female' as const,
    interests: ['football' as const],
    bio: null,
    preferredLanguages: ['en' as const],
    avatarUrl: null,
    photoUrls: ['https://cdn.example.com/a.jpg'],
    isVerified: true,
    trustScore: 4.88,
    interactionCount: 12,
    ratingsCount: 0,
    createdAt: '2026-09-05T10:00:00Z',
  };

  it('validates a public profile and rejects missing/out-of-range fields', () => {
    expect(PublicProfileSchema.safeParse(publicProfile).success).toBe(true);
    expect(
      PublicProfileSchema.safeParse({ ...publicProfile, ratingsCount: undefined }).success
    ).toBe(false);
    expect(
      PublicProfileSchema.safeParse({ ...publicProfile, trustScore: 6 }).success
    ).toBe(false);
    expect(
      PublicProfileSchema.safeParse({ ...publicProfile, photoUrls: ['not-a-url'] }).success
    ).toBe(false);
  });

  it('accepts an available or unavailable fuzzed distance', () => {
    expect(FuzzedDistanceSchema.safeParse({ available: true, distanceM: 100 }).success).toBe(true);
    expect(FuzzedDistanceSchema.safeParse({ available: true }).success).toBe(true);
    expect(FuzzedDistanceSchema.safeParse({ available: false }).success).toBe(true);
    expect(FuzzedDistanceSchema.safeParse({ available: 'yes' }).success).toBe(false);
    expect(FuzzedDistanceSchema.safeParse({ available: true, distanceM: -5 }).success).toBe(false);
  });

  it('exposes the canonical report reasons and a strict block contract', () => {
    expect(REPORT_REASONS).toContain('harassment');
    expect(REPORT_REASONS).toHaveLength(6);
    expect(
      BlockActionResultSchema.safeParse({
        success: true,
        blocked_id: '00000000-0000-0000-0000-000000000002',
      }).success
    ).toBe(true);
    expect(BlockActionResultSchema.safeParse({ success: false }).success).toBe(false);
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
