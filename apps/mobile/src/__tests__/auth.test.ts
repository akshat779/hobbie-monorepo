import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, DEV_PERSONAS } from '../features/auth/useAuthStore';

describe('useAuthStore', () => {
  beforeEach(() => {
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
