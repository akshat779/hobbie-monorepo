import { Coordinates } from '../schemas/activity.schema.js';
import { PRIVACY_CONFIG } from '../constants/ttl.js';

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
 * Ensures exact location is never revealed to unaccepted users on the public map.
 */
export function fuzzCoordinates(
  coord: Coordinates,
  fuzzRadiusMeters: number = PRIVACY_CONFIG.FUZZ_RADIUS_METERS
): Coordinates {
  // Random angle in radians
  const angle = Math.random() * 2 * Math.PI;
  // Enforce a non-zero displacement floor (30m) so exact location is strictly never leaked
  const minDistance = Math.min(30, fuzzRadiusMeters * 0.3);
  const distance = minDistance + Math.random() * (fuzzRadiusMeters - minDistance);

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
 * Formats a coordinate pair as PostGIS EWKT Point representation (SRID=4326;POINT(lng lat))
 */
export function toEwktPoint(coord: Coordinates, srid = 4326): string {
  return `SRID=${srid};POINT(${coord.longitude} ${coord.latitude})`;
}
