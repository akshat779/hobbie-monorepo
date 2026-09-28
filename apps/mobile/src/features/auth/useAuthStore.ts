import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../services/supabase';
import { Database, UserProfileInput, UserProfileSchema, PhoneAuthSchema } from '@hobbie/shared';

type ProfileState = Pick<Database['public']['Tables']['profiles']['Row'],
  'id' | 'name' | 'birth_date' | 'gender' | 'interests' | 'is_verified' |
  'trust_score' | 'interaction_count' | 'avatar_url' | 'photo_urls' | 'bio' | 'preferred_languages' |
  'created_at' | 'updated_at'> & {
  phone?: string;
};
const PROFILE_COLUMNS = 'id, name, birth_date, gender, interests, is_verified, trust_score, interaction_count, avatar_url, photo_urls, bio, preferred_languages, created_at, updated_at';

const isDevelopment =
  typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
// Keep the long-lived dev auth workflow available by default in non-production
// builds, while allowing CI/release builds to explicitly disable it.
const isDevAuthEnabled =
  isDevelopment && process.env.EXPO_PUBLIC_DEV_AUTH_ENABLED !== 'false';

/**
 * A real account that can be impersonated from the dev-only switcher. This is
 * sourced from `public.profiles`, not a hardcoded fixture, so every account
 * created through the onboarding flow becomes switchable in place.
 */
export interface DevUserSummary {
  id: string;
  name: string;
  avatar_url: string | null;
  is_verified: boolean;
  trust_score: number;
}

/**
 * Authenticates a phone number into an authentic Supabase Auth session in development.
 * 1. Attempts Supabase Edge Function 'dev-phone-login' (trusted server runtime).
 * 2. If Edge Function is not yet deployed, seamlessly falls back to direct shadow auth
 *    via supabase.auth.signUp() / signInWithPassword() with the public anon key.
 *
 * In BOTH cases, a REAL cryptographic JWT and Supabase Session are established!
 */
export async function authenticateDevSession(
  phone: string,
  name?: string
): Promise<{ session: Session | null; error?: string }> {
  if (!isDevAuthEnabled) {
    return { session: null, error: 'Development authentication is disabled' };
  }

  const normalizedPhone = phone.trim().startsWith('+')
    ? phone.trim()
    : `+${phone.trim()}`;
  const phoneValidation = PhoneAuthSchema.safeParse({ phone: normalizedPhone });
  if (!phoneValidation.success) {
    return { session: null, error: 'Invalid phone number format' };
  }
  const phoneDigits = normalizedPhone.replace(/[^0-9]/g, '');
  const shadowEmail = `phone_${phoneDigits}@dev.hobbie.internal`;
  const devPassword = `HobbieDevPass_${phoneDigits}!`;

  // 1. Try Supabase Edge Function first
  try {
    const { data: edgeData, error: edgeError } = await supabase.functions.invoke(
      'dev-phone-login',
      {
        body: { phone: normalizedPhone, name },
      }
    );

    if (!edgeError && edgeData?.session) {
      const { error: sessionError } = await supabase.auth.setSession(edgeData.session);
      if (sessionError) {
        return { session: null, error: sessionError.message };
      }
      return { session: edgeData.session };
    }
  } catch {
    // Edge function not deployed yet, proceed to direct shadow auth bridge
  }

  // 2. Direct Shadow Auth Bridge fallback (uses public anon key, works everywhere)
  try {
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: shadowEmail,
        password: devPassword,
      });

    if (!signInError && signInData?.session) {
      const { error: sessionError } = await supabase.auth.setSession(signInData.session);
      if (sessionError) {
        return { session: null, error: sessionError.message };
      }
      return { session: signInData.session };
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: shadowEmail,
      password: devPassword,
      options: {
        data: {
          name: name || 'Hobbie Player',
          phone: normalizedPhone,
        },
      },
    });

    if (!signUpError && signUpData?.session) {
      const { error: sessionError } = await supabase.auth.setSession(signUpData.session);
      if (sessionError) {
        return { session: null, error: sessionError.message };
      }
      return { session: signUpData.session };
    }

    if (signUpError) {
      return { session: null, error: signUpError.message };
    }

    return { session: null, error: 'Failed to establish Supabase session' };
  } catch (err) {
    return { session: null, error: err instanceof Error ? err.message : 'Dev authentication failed' };
  }
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: ProfileState | null;
  isLoading: boolean;
  isDevMode: boolean;
  activeDevUserId: string | null;
  devUsers: DevUserSummary[];

  // Actions
  initialize: () => Promise<void>;
  signInWithPhone: (phone: string) => Promise<{ error?: string }>;
  verifyOtp: (phone: string, token: string) => Promise<{ hasProfile: boolean; error?: string }>;
  upsertProfile: (input: UserProfileInput) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  loadDevUsers: () => Promise<void>;
  switchDevUser: (userId: string) => Promise<void>;
}

let isAuthListenerRegistered = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isDevMode: isDevelopment,
  activeDevUserId: null,
  devUsers: [],

  initialize: async () => {
    try {
      set({ isLoading: true });

      // Check current session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select(PROFILE_COLUMNS)
          .eq('id', session.user.id)
          .maybeSingle();

        set({
          session,
          user: session.user,
          profile,
          activeDevUserId: isDevAuthEnabled ? session.user.id : null,
          isLoading: false,
        });
      } else {
        // No persisted session: start unauthenticated. Dev accounts are
        // selected explicitly through onboarding or the dev user switcher, so
        // cold starts never silently impersonate a fixture account.
        set({ session: null, user: null, profile: null, activeDevUserId: null, isLoading: false });
      }

      // Listen to Auth state changes if supported (ensure single global listener)
      if (!isAuthListenerRegistered && typeof supabase?.auth?.onAuthStateChange === 'function') {
        isAuthListenerRegistered = true;
        supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session?.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select(PROFILE_COLUMNS)
              .eq('id', session.user.id)
              .maybeSingle();

            set({
              session,
              user: session.user,
              profile,
              activeDevUserId: isDevAuthEnabled ? session.user.id : null,
              isLoading: false,
            });
          } else {
            // A null session means the Supabase client is now unauthenticated
            // (token-refresh failure, revocation, or sign-out). Drop
            // `session` and `user` so session-gated queries stop firing as the
            // `anon` role.
            set({
              session: null,
              user: null,
              profile: null,
              activeDevUserId: null,
              isLoading: false,
            });
          }
        });
      }
    } catch (err) {
      console.warn('Auth initialization error:', err);
      set({ isLoading: false });
    }
  },

  signInWithPhone: async (phone: string) => {
    try {
      set({ isLoading: true });
      const { error } = await supabase.auth.signInWithOtp({ phone });
      set({ isLoading: false });

      if (error) {
        // In development mode: if third-party SMS provider (Twilio/MessageBird) is not configured in Supabase yet,
        // fallback to dev OTP flow so testing any phone number is not blocked.
        if (
          isDevelopment &&
          (error.message.includes('Unsupported phone provider') ||
            error.message.includes('Phone provider is not enabled') ||
            error.message.includes('provider is not enabled'))
        ) {
          console.info(
            `[Dev Auth] SMS provider not configured in Supabase. Dev OTP active for ${phone}.`
          );
          return {};
        }

        return { error: error.message };
      }
      return {};
    } catch (err) {
      set({ isLoading: false });
      return { error: err instanceof Error ? err.message : 'Failed to send OTP' };
    }
  },

  verifyOtp: async (phone: string, token: string) => {
    try {
      set({ isLoading: true });

      // In production or when real SMS provider is enabled:
      if (
        !isDevAuthEnabled ||
        process.env.EXPO_PUBLIC_USE_REAL_SMS === 'true' ||
        process.env.USE_REAL_SMS === 'true'
      ) {
        const { data, error } = await supabase.auth.verifyOtp({
          phone,
          token,
          type: 'sms',
        });

        if (error) {
          set({ isLoading: false });
          return { hasProfile: false, error: error.message };
        }

        if (data.session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select(PROFILE_COLUMNS)
            .eq('id', data.session.user.id)
            .maybeSingle();

          set({
            session: data.session,
            user: data.session.user,
            profile,
            isLoading: false,
          });

          return { hasProfile: !!profile };
        }
      }

      // In development: Authenticate with a genuine Supabase Auth session!
      const { session, error } = await authenticateDevSession(phone);

      if (error || !session) {
        set({ isLoading: false });
        return { hasProfile: false, error: error || 'Failed to authenticate dev session' };
      }

      // Query database for existing profile with real authenticated session
      const { data: profile } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', session.user.id)
        .maybeSingle();

      set({
        session,
        user: session.user,
        profile,
        activeDevUserId: session.user.id,
        isLoading: false,
      });

      return { hasProfile: !!profile };
    } catch (err) {
      set({ isLoading: false });
      return { hasProfile: false, error: err instanceof Error ? err.message : 'OTP verification failed' };
    }
  },

  upsertProfile: async (input: UserProfileInput) => {
    try {
      const validated = UserProfileSchema.parse(input);
      const user = get().user;
      if (!user) {
        return { error: 'You must be signed in to create a profile' };
      }

      // Resolve user's authenticated phone number
      const metadataPhone =
        typeof user.user_metadata?.phone === 'string' ? user.user_metadata.phone : '';
      const rawPhone = (user.phone || metadataPhone || '').trim();
      if (!rawPhone) {
        return { error: 'Authentication session is missing a verified phone number' };
      }

      // Normalize to E.164 standard (guarantee leading '+')
      const normalizedPhone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;

      // Validate against shared E.164 Zod schema
      const phoneValidation = PhoneAuthSchema.safeParse({ phone: normalizedPhone });
      if (!phoneValidation.success) {
        return { error: 'Invalid phone number format for profile' };
      }

      set({ isLoading: true });

      // Split editable profile details from database-owned trust/verification
      // metrics. The latter are never part of this payload.
      const profileDetails = {
        name: validated.name,
        birth_date: validated.birthDate,
        gender: validated.gender,
        interests: validated.interests,
        preferred_languages: validated.preferredLanguages,
        bio: validated.bio ?? null,
        photo_urls: validated.photoUrls ?? [],
        avatar_url: validated.avatarUrl ?? validated.photoUrls?.[0] ?? null,
        updated_at: new Date().toISOString(),
      };

      // Determine whether this is first-time onboarding or a detail edit.
      const { data: existingProfile, error: lookupError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (lookupError) {
        set({ isLoading: false });
        return { error: lookupError.message };
      }

      if (existingProfile) {
        // Existing profile: update editable details only. is_verified,
        // trust_score, interaction_count and ratings_count are owned by the
        // database and must survive a profile save untouched.
        const { data, error } = await supabase
          .from('profiles')
          .update({ ...profileDetails, phone: normalizedPhone })
          .eq('id', user.id)
          .select(PROFILE_COLUMNS)
          .single();

        set({ isLoading: false });

        if (error) {
          return { error: error.message };
        }

        set({ profile: data });
        return {};
      }

      // First-time onboarding: insert and let the database column defaults
      // apply (is_verified = false, trust_score = 5.00, interaction_count = 0).
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          phone: normalizedPhone,
          ...profileDetails,
        })
        .select(PROFILE_COLUMNS)
        .single();

      set({ isLoading: false });

      if (error) {
        return { error: error.message };
      }

      set({ profile: data });
      return {};
    } catch (err: unknown) {
      set({ isLoading: false });
      return { error: err instanceof Error ? err.message : 'Failed to save profile' };
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    set({
      session: null,
      user: null,
      profile: null,
      activeDevUserId: null,
    });
  },

  loadDevUsers: async () => {
    if (!isDevAuthEnabled) return; // Hard security lock: dev tools disabled in production

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, is_verified, trust_score')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('loadDevUsers error:', error.message);
        return;
      }

      set({ devUsers: data ?? [] });
    } catch (err) {
      console.warn('loadDevUsers failed:', err);
    }
  },

  switchDevUser: async (userId: string) => {
    if (!isDevAuthEnabled) return; // Hard security lock: dev tools disabled in production
    if (get().user?.id === userId) return; // Already acting as this account

    set({ isLoading: true });

    try {
      // Mints an authentic session for the target account server-side. The
      // phone number (the only credential) never leaves the Edge Function.
      const { data, error } = await supabase.functions.invoke('dev-phone-login', {
        body: { userId },
      });

      if (error || !data?.session) {
        console.warn(
          'switchDevUser error:',
          error?.message ?? 'Dev session switch is unavailable'
        );
        set({ isLoading: false });
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession(data.session);
      if (sessionError) {
        console.warn('switchDevUser setSession error:', sessionError.message);
        set({ isLoading: false });
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', data.session.user.id)
        .maybeSingle();

      set({
        session: data.session,
        user: data.session.user,
        profile: profile ?? null,
        activeDevUserId: data.session.user.id,
        isLoading: false,
      });
    } catch (err) {
      console.warn('switchDevUser failed:', err);
      set({ isLoading: false });
    }
  },
}));
