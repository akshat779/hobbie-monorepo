import { describe, it, expect } from 'vitest';
import { calculateRollingTrustScore } from '../../modules/trust/trust.service.js';

describe('Trust Scoring Engine', () => {
  it('returns default initial score when user has no ratings', () => {
    const result = calculateRollingTrustScore([]);
    expect(result.trustScore).toBe(5.0);
    expect(result.sampleSize).toBe(0);
    expect(result.isLimited).toBe(false);
  });

  it('calculates average over recent ratings', () => {
    const ratings = [
      { score: 5, createdAt: new Date('2026-08-30T10:00:00Z') },
      { score: 4, createdAt: new Date('2026-08-30T11:00:00Z') },
      { score: 5, createdAt: new Date('2026-08-30T12:00:00Z') },
    ];
    const result = calculateRollingTrustScore(ratings);
    expect(result.trustScore).toBe(4.7);
    expect(result.sampleSize).toBe(3);
    expect(result.isLimited).toBe(false);
  });

  it('flags user for limited visibility if rolling average drops below 3.0', () => {
    const ratings = [
      { score: 2, createdAt: new Date('2026-08-30T10:00:00Z') },
      { score: 1, createdAt: new Date('2026-08-30T11:00:00Z') },
      { score: 2, createdAt: new Date('2026-08-30T12:00:00Z') },
    ];
    const result = calculateRollingTrustScore(ratings);
    expect(result.trustScore).toBe(1.7);
    expect(result.isLimited).toBe(true);
  });
});
