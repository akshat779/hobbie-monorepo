import {
  type Coordinates,
  PRIVACY_CONFIG,
  calculateDistanceKm,
  fuzzCoordinates,
} from '@hobbie/shared';

export type { Coordinates };
export { calculateDistanceKm, fuzzCoordinates };

/**
 * Evaluates whether reverse nudge notification qualifies under k-anonymity floor.
 */
export function checkKAnonymityThreshold(
  userCountInRadius: number,
  floor: number = PRIVACY_CONFIG.K_ANONYMITY_FLOOR
): { shouldNotify: boolean; displayCount: number | null } {
  if (userCountInRadius >= floor) {
    return { shouldNotify: true, displayCount: userCountInRadius };
  }
  return { shouldNotify: false, displayCount: null };
}
