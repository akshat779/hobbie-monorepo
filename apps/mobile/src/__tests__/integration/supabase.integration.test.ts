import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { CreateActivitySchema, Database, fuzzCoordinates, toEwktPoint } from '@hobbie/shared';

const runIntegration = process.env.RUN_SUPABASE_INTEGRATION === 'true';
const describeIntegration = describe.skipIf(!runIntegration);

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hostPhone = process.env.SUPABASE_E2E_HOST_PHONE || '+919876543210';
const joinerPhone = process.env.SUPABASE_E2E_JOINER_PHONE || '+919876543211';

const createTestClient = () => {
  if (!url || !anonKey) throw new Error('Supabase integration requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  return createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
};

function rpcRecord(value: unknown): { id: string; status: string } {
  if (!value || typeof value !== 'object' || !('id' in value) || !('status' in value)
    || typeof value.id !== 'string' || typeof value.status !== 'string') {
    throw new Error('Unexpected RPC response shape');
  }
  return { id: value.id, status: value.status };
}

describeIntegration('Remote Supabase mobile flow', () => {
  let host: ReturnType<typeof createTestClient>;
  let joiner: ReturnType<typeof createTestClient>;
  const admin = serviceRoleKey && url
    ? createClient<Database>(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  let activityId: string | null = null;

  beforeAll(async () => {
    host = createTestClient();
    joiner = createTestClient();
    if (!serviceRoleKey) throw new Error('Supabase integration requires SUPABASE_SERVICE_ROLE_KEY for cleanup');
    const hostAuth = await host.functions.invoke('dev-phone-login', { body: { phone: hostPhone, name: 'E2E Host' } });
    const joinerAuth = await joiner.functions.invoke('dev-phone-login', { body: { phone: joinerPhone, name: 'E2E Joiner' } });
    if (hostAuth.error || !hostAuth.data?.session || joinerAuth.error || !joinerAuth.data?.session) {
      throw new Error(hostAuth.error?.message || joinerAuth.error?.message || 'dev-phone-login did not return sessions');
    }
    const hostSession = await host.auth.setSession(hostAuth.data.session);
    const joinerSession = await joiner.auth.setSession(joinerAuth.data.session);
    if (hostSession.error || joinerSession.error) throw new Error(hostSession.error?.message || joinerSession.error?.message);
  });

  afterAll(async () => {
    if (activityId && admin) {
      const { error } = await admin.from('activities').delete().eq('id', activityId);
      if (error) console.warn(`Supabase integration cleanup failed: ${error.message}`);
    }
  });

  it('authenticates, creates, discovers, joins, accepts, and exchanges a room message', async () => {
    const hostUser = (await host.auth.getUser()).data.user;
    const joinerUser = (await joiner.auth.getUser()).data.user;
    if (!hostUser || !joinerUser) throw new Error('Expected authenticated test users');

    const coordinates = { latitude: 12.9716, longitude: 77.5946 };
    const payload = CreateActivitySchema.parse({
      interestId: 'football', title: `E2E Squad ${Date.now()}`, description: 'Integration test squad',
      tier: 'physical', location: coordinates, ttlHours: 1, maxParticipants: 2, filterGender: 'any',
    });
    const expiresAt = new Date(Date.now() + payload.ttlHours * 60 * 60 * 1000).toISOString();
    const { data: activity, error: activityError } = await host.from('activities').insert({
      host_id: hostUser.id, interest_id: payload.interestId, title: payload.title,
      description: payload.description, tier: payload.tier, location: toEwktPoint(coordinates),
      fuzzed_location: toEwktPoint(fuzzCoordinates(coordinates)), expires_at: expiresAt,
      max_participants: payload.maxParticipants, current_participants_count: 1,
      filter_gender: payload.filterGender, status: 'open', venue_name: null,
    }).select('id').single();
    if (activityError || !activity) throw activityError ?? new Error('Activity creation failed');
    activityId = activity.id;

    const { data: nearby, error: nearbyError } = await joiner.rpc('get_nearby_activities', {
      user_lat: coordinates.latitude, user_lng: coordinates.longitude, radius_km: 4.5,
    });
    expect(nearbyError).toBeNull();
    expect(nearby?.some((row) => row.id === activity.id)).toBe(true);

    const { data: request, error: requestError } = await joiner.rpc('request_to_join_activity', {
      p_activity_id: activity.id, p_user_id: joinerUser.id, p_message: 'Ready to play',
    });
    expect(requestError).toBeNull();
    const requestRecord = rpcRecord(request);
    expect(requestRecord.status).toBe('pending');

    const { data: accepted, error: acceptedError } = await host.rpc('accept_join_request_tx', {
      p_request_id: requestRecord.id, p_host_id: hostUser.id,
    });
    expect(acceptedError).toBeNull();
    expect(rpcRecord(accepted).status).toBe('full');

    const { data: message, error: messageError } = await joiner.from('room_messages').insert({
      activity_id: activity.id, sender_id: joinerUser.id, content: 'See you there',
    }).select('id, content').single();
    expect(messageError).toBeNull();
    expect(message?.content).toBe('See you there');
  });
});
