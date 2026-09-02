import { describe, it, expect } from 'vitest';
import {
  PhoneAuthSchema,
  VerifyOtpSchema,
  UserProfileSchema,
} from '../schemas/user.schema.js';
import { CreateActivitySchema } from '../schemas/activity.schema.js';

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
    };
    expect(UserProfileSchema.safeParse(validAdult).success).toBe(true);

    const underage = {
      name: 'Youngster',
      birthDate: '2020-01-01',
      gender: 'male' as const,
      interests: ['football' as const],
    };
    expect(UserProfileSchema.safeParse(underage).success).toBe(false);
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
});
