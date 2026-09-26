/**
 * Local-timezone-safe date helpers for the `YYYY-MM-DD` birth_date contract
 * stored on `public.profiles`.
 */

/**
 * Parses a `YYYY-MM-DD` string into a local `Date`, avoiding the UTC drift of
 * `new Date('YYYY-MM-DD')`. Returns `null` for missing, malformed, or
 * non-existent calendar dates (e.g. `2021-02-31`).
 */
export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  // Reject rollover dates such as 2021-02-31 -> 2021-03-03.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * Whole-year age from a `YYYY-MM-DD` birth date, evaluated in local time.
 * Returns `null` when the date is missing/invalid or in the future.
 */
export function calculateAge(
  birthDate: string | null | undefined,
  now: Date = new Date()
): number | null {
  const birth = parseIsoDate(birthDate);
  if (!birth) return null;

  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}
