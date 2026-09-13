import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { FastifyInstance } from 'fastify';
import { supabaseAdmin } from '../../shared/supabase.js';
import { DiscoveryQuerySchema } from '@hobbie/shared';

describe('Server Integration: Health & Discovery API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    (vi.spyOn(supabaseAdmin, 'rpc') as any).mockImplementation(async (fn: string, args: any) => {
      if (fn === 'get_nearby_activities') {
        const parsed = DiscoveryQuerySchema.safeParse({
          latitude: args.user_lat,
          longitude: args.user_lng,
          radiusKm: args.radius_km,
        });
        if (!parsed.success) {
          return { data: null, error: { message: 'Invalid coordinate contract' } } as any;
        }
        return {
          data: [
            {
              id: '00000000-0000-0000-0000-000000000001',
              host_id: '00000000-0000-0000-0000-000000000002',
              interest_id: 'football',
              title: 'Turf Match 5v5',
              description: 'Friendly game',
              tier: 'physical',
              lat: 12.9716,
              lng: 77.5946,
              venue_name: 'Koramangala Arena',
              expires_at: new Date(Date.now() + 3600000).toISOString(),
              max_participants: 10,
              current_participants_count: 6,
              distance_meters: 250,
            },
          ],
          error: null,
        } as any;
      }
      return { data: null, error: { message: `Function ${fn} not found` } } as any;
    });

    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it('GET /health returns 200 OK', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('GET /api/v1/discovery filters by coordinates and radius', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/discovery?latitude=12.9716&longitude=77.5946&radiusKm=5',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.activities)).toBe(true);
    expect(body.activities).toHaveLength(1);
    expect(body.activities[0].title).toBe('Turf Match 5v5');
  });

  it('GET /api/v1/discovery rejects invalid coordinates out of bounds', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/discovery?latitude=999&longitude=77.5946&radiusKm=5',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
  });

  it('POST /api/v1/activities rejects unauthenticated requests', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/activities',
      payload: {
        interestId: 'football',
        title: 'Unauthorized Game',
        location: { latitude: 12.9716, longitude: 77.5946 },
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
