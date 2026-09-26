import { describe, it, expect } from 'vitest';
import { calculateAge, parseIsoDate } from '../utils/age.js';

describe('parseIsoDate', () => {
  it('parses YYYY-MM-DD in local time without UTC drift', () => {
    const date = parseIsoDate('1998-05-12');
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(1998);
    expect(date!.getMonth()).toBe(4);
    expect(date!.getDate()).toBe(12);
  });

  it('rejects missing, malformed, and rollover dates', () => {
    expect(parseIsoDate(null)).toBeNull();
    expect(parseIsoDate(undefined)).toBeNull();
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate('12/05/1998')).toBeNull();
    expect(parseIsoDate('1998-5-12')).toBeNull();
    expect(parseIsoDate('2021-02-31')).toBeNull();
  });
});

describe('calculateAge', () => {
  const now = new Date(2026, 8, 23); // 2026-09-23 in local time

  it('returns whole years for a birthday already reached this year', () => {
    expect(calculateAge('1998-05-12', now)).toBe(28);
  });

  it('does not count a birthday that has not happened yet this year', () => {
    expect(calculateAge('1998-12-31', now)).toBe(27);
  });

  it('counts the birthday on the exact day, but not the day after', () => {
    expect(calculateAge('2000-09-23', now)).toBe(26);
    expect(calculateAge('2000-09-24', now)).toBe(25);
  });

  it('returns null for missing, invalid, or future dates', () => {
    expect(calculateAge(null, now)).toBeNull();
    expect(calculateAge('not-a-date', now)).toBeNull();
    expect(calculateAge('2030-01-01', now)).toBeNull();
  });
});
