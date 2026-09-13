import { describe, it, expect } from 'vitest';
import { calculateLiveTtl } from '../hooks/useCountdown';

describe('calculateLiveTtl', () => {
  const baseNow = new Date('2026-09-14T10:00:00.000Z').getTime();

  it('formats hours and minutes when remaining time > 60 minutes', () => {
    // 1h 45m left
    const expiresAt = new Date('2026-09-14T11:45:00.000Z').toISOString();
    const result = calculateLiveTtl(expiresAt, baseNow);

    expect(result.isExpired).toBe(false);
    expect(result.minutesLeft).toBe(105);
    expect(result.formattedTtl).toBe('1h 45m');
    expect(result.urgency).toBe('fresh');
    expect(result.theme.primary).toBe('#C77DFF');
  });

  it('formats only minutes without leading 0h when remaining time < 60 minutes', () => {
    // 45 minutes left
    const expiresAt = new Date('2026-09-14T10:45:00.000Z').toISOString();
    const result = calculateLiveTtl(expiresAt, baseNow);

    expect(result.isExpired).toBe(false);
    expect(result.minutesLeft).toBe(45);
    expect(result.formattedTtl).toBe('45m'); // Not "0h 45m"
    expect(result.urgency).toBe('moderate');
    expect(result.theme.primary).toBe('#7B2FF7');
  });

  it('switches urgency to expiring and applies ember color when < 30 minutes left', () => {
    // 18 minutes left
    const expiresAt = new Date('2026-09-14T10:18:00.000Z').toISOString();
    const result = calculateLiveTtl(expiresAt, baseNow);

    expect(result.isExpired).toBe(false);
    expect(result.minutesLeft).toBe(18);
    expect(result.formattedTtl).toBe('18m');
    expect(result.urgency).toBe('expiring');
    expect(result.theme.primary).toBe('#FF6B5E'); // Ember theme
  });

  it('identifies expired activity when now >= expiresAt', () => {
    // 5 minutes in the past
    const expiresAt = new Date('2026-09-14T09:55:00.000Z').toISOString();
    const result = calculateLiveTtl(expiresAt, baseNow);

    expect(result.isExpired).toBe(true);
    expect(result.minutesLeft).toBe(0);
    expect(result.formattedTtl).toBe('Expired');
    expect(result.urgency).toBe('expired');
  });

  it('handles null or undefined gracefully', () => {
    const resultNull = calculateLiveTtl(null, baseNow);
    expect(resultNull.isExpired).toBe(true);
    expect(resultNull.formattedTtl).toBe('No Expiry');

    const resultUndefined = calculateLiveTtl(undefined, baseNow);
    expect(resultUndefined.isExpired).toBe(true);
  });
});
