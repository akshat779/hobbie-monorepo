/**
 * Canonical preferred-language catalogue.
 *
 * Mirrors the `check_preferred_languages` constraint in
 * supabase/migrations/20260922000001_add_profile_bio_languages_and_avatar_storage.sql
 * and the `preferred_languages` column on public.profiles (ISO 639-1 codes).
 */
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'mr', label: 'Marathi' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'ur', label: 'Urdu' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ar', label: 'Arabic' },
  { code: 'zh', label: 'Mandarin' },
  { code: 'ja', label: 'Japanese' },
] as const;

export type Language = (typeof LANGUAGES)[number];
export type LanguageCode = Language['code'];

/** Stable list of ISO 639-1 codes, suitable for `z.enum(...)`. */
export const LANGUAGE_CODES = LANGUAGES.map((language) => language.code) as [
  LanguageCode,
  ...LanguageCode[],
];

/** Maximum number of languages a user may mark as preferred. */
export const MAX_PREFERRED_LANGUAGES = 3;

/** Human-readable label for a language code, falling back to the raw code. */
export function languageLabel(code: string): string {
  return LANGUAGES.find((language) => language.code === code)?.label ?? code;
}
