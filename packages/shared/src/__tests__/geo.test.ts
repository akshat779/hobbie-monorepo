import { describe, it, expect } from 'vitest';
import { calculateDistanceKm, fuzzCoordinates, toEwktPoint } from '../utils/geo.js';

describe('Geo Utilities', () => {
  it('should calculate accurate Haversine distance between two coordinates', () => {
    // Bangalore MG Road to Indiranagar (~4 km)
    const mgRoad = { latitude: 12.9756, longitude: 77.6066 };
    const indiranagar = { latitude: 12.9784, longitude: 77.6408 };

    const distance = calculateDistanceKm(mgRoad, indiranagar);
    expect(distance).toBeGreaterThan(3.0);
    expect(distance).toBeLessThan(4.5);
  });

  it('should calculate 0 km for identical coordinates', () => {
    const point = { latitude: 12.9716, longitude: 77.5946 };
    expect(calculateDistanceKm(point, point)).toBe(0);
  });

  it('should fuzz coordinates within specified radius bounds (~100m)', () => {
    const origin = { latitude: 12.9716, longitude: 77.5946 };
    const fuzzed = fuzzCoordinates(origin, 100);

    // Coordinate must be slightly modified
    const distanceKm = calculateDistanceKm(origin, fuzzed);
    const distanceMeters = distanceKm * 1000;

    // Fuzzed point should be <= 150m away (allowing rounding tolerance)
    expect(distanceMeters).toBeLessThanOrEqual(150);
  });

  it('should format coordinates as valid PostGIS EWKT representation', () => {
    const point = { latitude: 12.9716, longitude: 77.5946 };
    const ewkt = toEwktPoint(point);
    expect(ewkt).toBe('SRID=4326;POINT(77.5946 12.9716)');
  });
});
