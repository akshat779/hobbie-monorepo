import { describe, it, expect } from 'vitest';
import {
  INTEREST_CATEGORIES,
  INTEREST_IDS,
  interestLabel,
  interestEmoji,
} from '../constants/interests.js';

describe('interest catalogue', () => {
  it('exposes unique ids', () => {
    expect(new Set(INTEREST_IDS).size).toBe(INTEREST_IDS.length);
    expect(INTEREST_IDS).toContain('football');
    expect(INTEREST_IDS).toContain('coding_tech');
  });

  it('maps ids to canonical human-readable labels with an id fallback', () => {
    expect(interestLabel('football')).toBe('Football');
    expect(interestLabel('gym_fitness')).toBe('Gym & Fitness');
    expect(interestLabel('cafe_coffee')).toBe('Coffee & Cafe');
    expect(interestLabel('unknown_interest')).toBe('unknown_interest');
  });

  it('keeps the taxonomy at the documented ten categories', () => {
    expect(INTEREST_CATEGORIES).toHaveLength(10);
  });

  it('maps every interest id to a non-empty map-pin emoji with a fallback', () => {
    expect(interestEmoji('football')).toBe('⚽');
    expect(interestEmoji('cafe_coffee')).toBe('☕');
    expect(interestEmoji('unknown_interest')).toBe('✨');

    for (const id of INTEREST_IDS) {
      expect(interestEmoji(id).length).toBeGreaterThan(0);
    }
  });
});
