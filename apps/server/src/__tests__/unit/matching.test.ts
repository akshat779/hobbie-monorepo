import { describe, it, expect } from 'vitest';
import {
  calculateDistanceKm,
  checkKAnonymityThreshold,
} from '../../modules/matching/matching.service.js';

describe('Matching & Privacy Engine', () => {
  it('calculates Haversine distance correctly', () => {
    // Distance between two points in Bangalore Tech Park (~1.5 km)
    const p1 = { latitude: 12.9716, longitude: 77.5946 };
    const p2 = { latitude: 12.9800, longitude: 77.6000 };

    const distance = calculateDistanceKm(p1, p2);
    expect(distance).toBeGreaterThan(0.5);
    expect(distance).toBeLessThan(2.0);
  });

  it('enforces k-anonymity floor for reverse nudges', () => {
    expect(checkKAnonymityThreshold(5, 8)).toEqual({
      shouldNotify: false,
      displayCount: null,
    });
    expect(checkKAnonymityThreshold(12, 8)).toEqual({
      shouldNotify: true,
      displayCount: 12,
    });
  });
});
