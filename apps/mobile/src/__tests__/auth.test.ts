import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../features/auth/useAuthStore';
import { supabase } from '../services/supabase';

import { createContractMockSupabase, VALID_UUIDS } from './helpers/contractMocks';

vi.mock('../services/supabase', async () => {
  const { createContractMockSupabase } = await import('./helpers/contractMocks');
  return {
    supabase: createContractMockSupabase(),
  };
});

const ALEX_ID = VALID_UUIDS.alex;
const ALEX_PHONE = '+919876543210';
const ALEX_NAME = 'Alex Rivera';

const mockAlexUser = {
  id: ALEX_ID,
  phone: ALEX_PHONE,
  email: 'phone_919876543210@dev.hobbie.internal',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
};

const mockAlexSession = {
  access_token: 'fake-jwt-alex',
  refresh_token: 'fake-refresh-alex',
  expires_in: 3600,
  token_type: 'bearer',
  user: mockAlexUser,
};

const mockAlexProfile = {
  id: ALEX_ID,
  phone: ALEX_PHONE,
  name: ALEX_NAME,
  birth_date: '1998-05-12',
  gender: 'male',
  interests: ['football', 'badminton'],
  is_verified: true,
  trust_score: 4.95,
  interaction_count: 5,
  avatar_url: null,
  bio: null,
  preferred_languages: ['en'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (supabase.functions.invoke as any).mockResolvedValue({
      data: { session: mockAlexSession, user: mockAlexUser },
      error: null,
    });
    (supabase.auth.setSession as any).mockResolvedValue({
      data: { session: mockAlexSession, user: mockAlexUser },
      error: null,
    });
    (supabase.auth.signOut as any).mockResolvedValue({
      error: null,
    });
    const qb = (supabase.from as any)('profiles');
    qb.maybeSingle.mockResolvedValue({
      data: mockAlexProfile,
      error: null,
    });
    qb.single.mockResolvedValue({
      data: mockAlexProfile,
      error: null,
    });

    useAuthStore.setState({
      session: null,
      user: null,
      profile: null,
      activeDevUserId: null,
      devUsers: [],
      isLoading: false,
    });
  });

  it('should initialize with default state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.devUsers).toEqual([]);
    expect(state.isDevMode).toBe(true);
  });

  it('should switch to a real dev user via the dev-phone-login session bridge', async () => {
    const store = useAuthStore.getState();
    await store.switchDevUser(ALEX_ID);

    expect(supabase.functions.invoke).toHaveBeenCalledWith('dev-phone-login', {
      body: { userId: ALEX_ID },
    });

    const state = useAuthStore.getState();
    expect(state.user?.id).toBe(ALEX_ID);
    expect(state.profile?.name).toBe(ALEX_NAME);
    expect(state.activeDevUserId).toBe(ALEX_ID);
  });

  it('should not switch when the requested user is already active', async () => {
    useAuthStore.setState({ user: mockAlexUser, activeDevUserId: ALEX_ID });
    const store = useAuthStore.getState();
    await store.switchDevUser(ALEX_ID);

    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('should load real profiles into devUsers from the database', async () => {
    const store = useAuthStore.getState();
    await store.loadDevUsers();

    const state = useAuthStore.getState();
    expect(state.devUsers.length).toBeGreaterThan(0);
    expect(state.devUsers.some((u) => u.id === ALEX_ID)).toBe(true);
  });

  it('should stay unauthenticated on cold-start initialize when no session exists', async () => {
    (supabase.auth.getSession as any).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const store = useAuthStore.getState();
    await store.initialize();

    const state = useAuthStore.getState();
    expect(state.profile).toBeNull();
    expect(state.user).toBeNull();
    expect(state.activeDevUserId).toBeNull();
  });

  it('should authenticate with 123456 dev bypass OTP', async () => {
    const store = useAuthStore.getState();
    const result = await store.verifyOtp('+919876543210', '123456');

    expect(result.hasProfile).toBe(true);
    const state = useAuthStore.getState();
    expect(state.user?.phone).toBe('+919876543210');
    expect(state.profile?.name).toBe(ALEX_NAME);
  });

  it('should clear state on signOut', async () => {
    const store = useAuthStore.getState();
    await store.switchDevUser(ALEX_ID);
    expect(useAuthStore.getState().user).not.toBeNull();

    await store.signOut();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().profile).toBeNull();
    expect(useAuthStore.getState().activeDevUserId).toBeNull();
  });

  describe('upsertProfile', () => {
    it('should normalize un-prefixed phone number to E.164 and save successfully', async () => {
      // Simulate Supabase GoTrue returning user.phone without '+'
      useAuthStore.setState({
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          phone: '919876543210',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        },
      });

      const qb = (supabase.from as any)('profiles');
      qb.single.mockResolvedValue({
        data: {
          id: '00000000-0000-0000-0000-000000000001',
          phone: '+919876543210',
          name: 'Akshat',
          birth_date: '2000-01-01',
          gender: 'male',
          interests: ['football', 'badminton'],
        },
        error: null,
      });

      const store = useAuthStore.getState();
      const res = await store.upsertProfile({
        name: 'Akshat',
        birthDate: '2000-01-01',
        gender: 'male',
        interests: ['football', 'badminton'],
        preferredLanguages: ['en'],
      });

      expect(res.error).toBeUndefined();
      expect(qb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+919876543210',
          name: 'Akshat',
        })
      );
      expect(useAuthStore.getState().profile?.name).toBe('Akshat');
    });

    it('should not overwrite database-owned trust metrics when updating an existing profile', async () => {
      useAuthStore.setState({
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          phone: '+919876543210',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        },
      });

      const qb = (supabase.from as any)('profiles');
      qb.maybeSingle.mockResolvedValue({
        data: { id: '00000000-0000-0000-0000-000000000001' },
        error: null,
      });

      const store = useAuthStore.getState();
      const res = await store.upsertProfile({
        name: 'Akshat',
        birthDate: '2000-01-01',
        gender: 'male',
        interests: ['football', 'badminton'],
        preferredLanguages: ['en'],
      });

      expect(res.error).toBeUndefined();
      const updatePayload = qb.update.mock.calls[0][0];
      expect(updatePayload).not.toHaveProperty('is_verified');
      expect(updatePayload).not.toHaveProperty('trust_score');
      expect(updatePayload).not.toHaveProperty('interaction_count');
      expect(updatePayload).not.toHaveProperty('ratings_count');
    });

    it('should insert a new profile with database-owned metrics omitted (first-time onboarding)', async () => {
      useAuthStore.setState({
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          phone: '+919876543210',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        },
      });

      const qb = (supabase.from as any)('profiles');
      qb.maybeSingle.mockResolvedValue({ data: null, error: null });

      const store = useAuthStore.getState();
      const res = await store.upsertProfile({
        name: 'Akshat',
        birthDate: '2000-01-01',
        gender: 'male',
        interests: ['football'],
        preferredLanguages: ['en'],
      });

      expect(res.error).toBeUndefined();
      const insertPayload = qb.insert.mock.calls[0][0];
      expect(insertPayload.phone).toBe('+919876543210');
      expect(insertPayload).not.toHaveProperty('is_verified');
      expect(insertPayload).not.toHaveProperty('trust_score');
      expect(insertPayload).not.toHaveProperty('interaction_count');
    });

    it('should persist bio and preferred languages during onboarding', async () => {
      useAuthStore.setState({
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          phone: '+919876543210',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        },
      });

      const qb = (supabase.from as any)('profiles');
      qb.maybeSingle.mockResolvedValue({ data: null, error: null });

      const store = useAuthStore.getState();
      const res = await store.upsertProfile({
        name: 'Akshat',
        birthDate: '2000-01-01',
        gender: 'male',
        interests: ['football'],
        preferredLanguages: ['en', 'hi'],
        bio: 'Weekend footballer.',
        avatarUrl: 'https://example.supabase.co/storage/v1/object/public/avatars/u/avatar.jpg',
      });

      expect(res.error).toBeUndefined();
      const insertPayload = qb.insert.mock.calls[0][0];
      expect(insertPayload.preferred_languages).toEqual(['en', 'hi']);
      expect(insertPayload.bio).toBe('Weekend footballer.');
      expect(insertPayload.avatar_url).toContain('/avatars/');
    });

    it('should persist the photo gallery and derive the cover avatar from the first photo', async () => {
      useAuthStore.setState({
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          phone: '+919876543210',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        },
      });

      const qb = (supabase.from as any)('profiles');
      qb.maybeSingle.mockResolvedValue({ data: null, error: null });

      const photos = [
        'https://example.supabase.co/storage/v1/object/public/avatars/u/photos/photo-0-a.jpg',
        'https://example.supabase.co/storage/v1/object/public/avatars/u/photos/photo-1-b.jpg',
      ];

      const store = useAuthStore.getState();
      const res = await store.upsertProfile({
        name: 'Akshat',
        birthDate: '2000-01-01',
        gender: 'male',
        interests: ['football'],
        preferredLanguages: ['en'],
        photoUrls: photos,
      });

      expect(res.error).toBeUndefined();
      const insertPayload = qb.insert.mock.calls[0][0];
      expect(insertPayload.photo_urls).toEqual(photos);
      expect(insertPayload.avatar_url).toBe(photos[0]);
    });

    it('should reject a profile with more than six photos at the database contract level', async () => {
      const query = (supabase.from('profiles') as any).upsert({
        id: VALID_UUIDS.alex,
        phone: '+919876543210',
        name: 'Alex Rivera',
        photo_urls: Array.from({ length: 7 }, (_, i) => `https://cdn.example.com/${i}.jpg`),
      });
      const res = await query.select().single();

      expect(res.error).toBeDefined();
      expect(res.error.code).toBe('23514');
      expect(res.error.message).toContain('check_photo_urls_count');
    });

    it('should reject a profile insert with more than three preferred languages at the database contract level', async () => {
      const query = (supabase.from('profiles') as any).upsert({
        id: VALID_UUIDS.alex,
        phone: '+919876543210',
        name: 'Alex Rivera',
        preferred_languages: ['en', 'hi', 'ta', 'bn'],
      });
      const res = await query.select().single();

      expect(res.error).toBeDefined();
      expect(res.error.code).toBe('23514');
      expect(res.error.message).toContain('check_preferred_languages');
    });

    it('should reject a profile insert with an unknown language code at the database contract level', async () => {
      const query = (supabase.from('profiles') as any).upsert({
        id: VALID_UUIDS.alex,
        phone: '+919876543210',
        name: 'Alex Rivera',
        preferred_languages: ['en', 'klingon'],
      });
      const res = await query.select().single();

      expect(res.error).toBeDefined();
      expect(res.error.code).toBe('23514');
      expect(res.error.message).toContain('check_preferred_languages');
    });

    it('should reject upsertProfile if user has no authenticated session', async () => {
      useAuthStore.setState({ user: null });
      const store = useAuthStore.getState();
      const res = await store.upsertProfile({
        name: 'Akshat',
        birthDate: '2000-01-01',
        gender: 'male',
        interests: ['football'],
        preferredLanguages: ['en'],
      });

      expect(res.error).toBe('You must be signed in to create a profile');
    });

    it('should reject upsertProfile if input violates UserProfileSchema', async () => {
      useAuthStore.setState({
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          phone: '+919876543210',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        },
      });

      const store = useAuthStore.getState();
      // Underage birth date (<18 years old)
      const res = await store.upsertProfile({
        name: 'Kid',
        birthDate: '2020-01-01',
        gender: 'male',
        interests: ['football'],
        preferredLanguages: ['en'],
      });

      expect(res.error).toBeDefined();
    });

    it('should reject profile upsert at database contract level when phone violates check_e164_phone', async () => {
      // Direct call to contract mock with invalid un-normalized phone
      const query = (supabase.from('profiles') as any).upsert({
        id: VALID_UUIDS.alex,
        phone: '919876543210', // Missing leading '+'
        name: 'Alex Rivera',
      });
      const res = await query.select().single();
      expect(res.error).toBeDefined();
      expect(res.error.code).toBe('23514');
      expect(res.error.message).toContain('check_e164_phone');
    });
  });
});
