import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore, DEV_PERSONAS } from '../features/auth/useAuthStore';
import { supabase } from '../services/supabase';

vi.mock('../services/supabase', () => {
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockInsert = vi.fn();
  const mockSingle = vi.fn();

  const queryBuilder = {
    select: mockSelect.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    maybeSingle: mockMaybeSingle,
    insert: mockInsert.mockReturnThis(),
    single: mockSingle,
  };

  const mockFrom = vi.fn(() => queryBuilder);
  const mockInvoke = vi.fn();
  const mockSetSession = vi.fn();
  const mockSignOut = vi.fn();
  const mockSignInWithPassword = vi.fn();
  const mockSignUp = vi.fn();

  return {
    supabase: {
      from: mockFrom,
      functions: {
        invoke: mockInvoke,
      },
      auth: {
        setSession: mockSetSession,
        signOut: mockSignOut,
        signInWithPassword: mockSignInWithPassword,
        signUp: mockSignUp,
      },
    },
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

  it('should switch personas instantly in dev mode', async () => {
    const store = useAuthStore.getState();
    await store.loginWithPersona(DEV_PERSONAS[0]!.id);

    const state = useAuthStore.getState();
    expect(state.user?.id).toBe(DEV_PERSONAS[0]!.id);
    expect(state.profile?.name).toBe('Alex Rivera');
    expect(state.profile?.trust_score).toBe(4.95);
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
});
