import { describe, it, expect } from 'vitest';
import { getInitials } from '../utils/initials.js';
import {
  LANGUAGES,
  LANGUAGE_CODES,
  MAX_PREFERRED_LANGUAGES,
  languageLabel,
} from '../constants/languages.js';

describe('getInitials', () => {
  it('returns the first two letters of a display name', () => {
    expect(getInitials('Alex Rivera')).toBe('AL');
    expect(getInitials('priya')).toBe('PR');
    expect(getInitials('  rohan  ')).toBe('RO');
  });

  it('handles short, empty, and nullish names', () => {
    expect(getInitials('A')).toBe('A');
    expect(getInitials('')).toBe('?');
    expect(getInitials(null)).toBe('?');
    expect(getInitials(undefined)).toBe('?');
  });
});

describe('language catalogue', () => {
  it('exposes unique ISO 639-1 codes', () => {
    expect(new Set(LANGUAGE_CODES).size).toBe(LANGUAGE_CODES.length);
    expect(LANGUAGE_CODES).toContain('en');
    expect(MAX_PREFERRED_LANGUAGES).toBe(3);
  });

  it('maps codes to human-readable labels with a code fallback', () => {
    expect(languageLabel('en')).toBe('English');
    expect(languageLabel('hi')).toBe('Hindi');
    expect(languageLabel('xx')).toBe('xx');
  });

  it('keeps the shared catalogue in sync with the database constraint', () => {
    const dbCodes = [
      'en', 'hi', 'bn', 'ta', 'te', 'mr', 'kn', 'ml', 'gu', 'pa', 'ur',
      'es', 'fr', 'de', 'ar', 'zh', 'ja',
    ];
    expect([...LANGUAGE_CODES].sort()).toEqual([...dbCodes].sort());
    expect(LANGUAGES).toHaveLength(dbCodes.length);
  });
});
