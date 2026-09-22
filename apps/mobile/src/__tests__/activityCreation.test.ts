import { describe, expect, it } from 'vitest';
import { buildActivityInsert } from '../services/activityPayload';

const hostId = '00000000-0000-0000-0000-000000000001';
const now = new Date('2026-09-06T12:00:00.000Z');

describe('activity creation service', () => {
  it('builds an exact canonical point and a separate public point', () => {
    const insert = buildActivityInsert(hostId, {
      interestId: 'football', title: 'Saturday football', description: 'Two spots',
      tier: 'physical', location: { latitude: 12.9716, longitude: 77.5946 },
      venueName: 'Turf Arena', ttlHours: 2, maxParticipants: 5,
      filterGender: 'female-only', filterAgeMin: 21, filterAgeMax: 35,
    }, now);
    expect(insert.host_id).toBe(hostId);
    expect(insert.location).toBe('SRID=4326;POINT(77.5946 12.9716)');
    expect(insert.fuzzed_location).not.toBe(insert.location);
    expect(insert.expires_at).toBe('2026-09-06T14:00:00.000Z');
    expect(insert.filter_age_min).toBe(21);
  });

  it('rejects inverted age ranges through the shared contract', () => {
    expect(() => buildActivityInsert(hostId, {
      interestId: 'football', title: 'Invalid', location: { latitude: 12, longitude: 77 },
      filterAgeMin: 40, filterAgeMax: 20,
    })).toThrow('Maximum age');
  });
});
