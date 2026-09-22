/**
 * Deterministic initials used as the avatar fallback when a user has not
 * uploaded a profile photo: the first two letters of their display name.
 */
export function getInitials(name: string | null | undefined): string {
  const letters = (name ?? '').replace(/[^\p{L}\p{N}]/gu, '');
  if (!letters) return '?';
  return letters.slice(0, 2).toUpperCase();
}
