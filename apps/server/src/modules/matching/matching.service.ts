import { Coordinates, PRIVACY_CONFIG } from '@hobbie/shared';

/**
 * Calculates Haversine distance in kilometers between two GPS coordinates.
 */
export function calculateDistanceKm(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.latitude * Math.PI) / 180) *
      Math.cos((coord2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100; // Rounded to 2 decimal places
}

/**
 * Applies privacy fuzzing to coordinates (~100m random displacement).
 * Ensures exact location is never revealed to non-members.
 */
export function fuzzCoordinates(
  coord: Coordinates,
  fuzzRadiusMeters: number = PRIVACY_CONFIG.FUZZ_RADIUS_METERS
): Coordinates {
  // Random angle in radians
  const angle = Math.random() * 2 * Math.PI;
  // Random distance up to fuzzRadiusMeters
  const distance = Math.random() * fuzzRadiusMeters;

  // 1 degree latitude ~= 111,320 meters
  const deltaLat = (distance * Math.cos(angle)) / 111320;
  // 1 degree longitude ~= 111,320 * cos(lat) meters
  const deltaLon =
    (distance * Math.sin(angle)) /
    (111320 * Math.cos((coord.latitude * Math.PI) / 180));

  return {
    latitude: Math.round((coord.latitude + deltaLat) * 100000) / 100000,
    longitude: Math.round((coord.longitude + deltaLon) * 100000) / 100000,
  };
}

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
