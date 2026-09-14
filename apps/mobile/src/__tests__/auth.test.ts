import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore, DEV_PERSONAS } from '../features/auth/useAuthStore';
import { supabase } from '../services/supabase';

import { createContractMockSupabase, VALID_UUIDS } from './helpers/contractMocks';

vi.mock('../services/supabase', async () => {
  const { createContractMockSupabase } = await import('./helpers/contractMocks');
  return {
    supabase: createContractMockSupabase(),
  };
});

const mockAlexUser = {
  id: DEV_PERSONAS[0]!.id,
  phone: DEV_PERSONAS[0]!.phone,
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
  id: DEV_PERSONAS[0]!.id,
  phone: DEV_PERSONAS[0]!.phone,
  name: DEV_PERSONAS[0]!.name,
  birth_date: DEV_PERSONAS[0]!.birthDate,
  gender: DEV_PERSONAS[0]!.gender,
  interests: DEV_PERSONAS[0]!.interests,
  is_verified: DEV_PERSONAS[0]!.isVerified,
  trust_score: DEV_PERSONAS[0]!.trustScore,
  interaction_count: 5,
  avatar_url: null,
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
      activePersonaId: null,
      isLoading: false,
    });
  });

  it('should initialize with default state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.isDevMode).toBe(true);
  });

  it('should switch personas instantly in dev mode with optimistic hydration', async () => {
    const store = useAuthStore.getState();
    const loginPromise = store.loginWithPersona(DEV_PERSONAS[0]!.id);

    // Optimistic state is updated synchronously in local memory before promise resolves
    const optimisticState = useAuthStore.getState();
    expect(optimisticState.profile?.name).toBe('Alex Rivera');
    expect(optimisticState.profile?.trust_score).toBe(4.95);
    expect(optimisticState.isLoading).toBe(false);

    await loginPromise;
    const finalState = useAuthStore.getState();
    expect(finalState.user?.id).toBe(DEV_PERSONAS[0]!.id);
    expect(finalState.profile?.name).toBe('Alex Rivera');
  });

  it('should auto-hydrate default persona on cold-start initialize in dev mode', async () => {
    (supabase.auth.getSession as any).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const store = useAuthStore.getState();
    await store.initialize();

    const state = useAuthStore.getState();
    expect(state.profile).not.toBeNull();
    expect(state.profile?.name).toBe('Alex Rivera');
    expect(state.activePersonaId).toBe(DEV_PERSONAS[0]!.id);
  });

  it('should authenticate with 123456 dev bypass OTP', async () => {
    const store = useAuthStore.getState();
    const result = await store.verifyOtp('+919876543210', '123456');

    expect(result.hasProfile).toBe(true);
    const state = useAuthStore.getState();
    expect(state.user?.phone).toBe('+919876543210');
    expect(state.profile?.name).toBe('Alex Rivera');
  });

  it('should clear state on signOut', async () => {
    const store = useAuthStore.getState();
    await store.loginWithPersona(DEV_PERSONAS[0]!.id);
    expect(useAuthStore.getState().user).not.toBeNull();

    await store.signOut();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().profile).toBeNull();
  });

  describe('upsertProfile', () => {
    it('should normalize un-prefixed phone number to E.164 and upsert successfully', async () => {
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
      });

      expect(res.error).toBeUndefined();
      expect(qb.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+919876543210',
          name: 'Akshat',
        })
      );
      expect(useAuthStore.getState().profile?.name).toBe('Akshat');
    });

    it('should reject upsertProfile if user has no authenticated session', async () => {
      useAuthStore.setState({ user: null });
      const store = useAuthStore.getState();
      const res = await store.upsertProfile({
        name: 'Akshat',
        birthDate: '2000-01-01',
        gender: 'male',
        interests: ['football'],
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
