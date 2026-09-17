import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../services/supabase';
import { Database, UserProfileInput, UserProfileSchema, PhoneAuthSchema } from '@hobbie/shared';

type ProfileState = Pick<Database['public']['Tables']['profiles']['Row'],
  'id' | 'name' | 'birth_date' | 'gender' | 'interests' | 'is_verified' |
  'trust_score' | 'interaction_count' | 'avatar_url' | 'created_at' | 'updated_at'> & {
  phone?: string;
};
const PROFILE_COLUMNS = 'id, name, birth_date, gender, interests, is_verified, trust_score, interaction_count, avatar_url, created_at, updated_at';

const isDevelopment =
  typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
// Keep the long-lived dev auth workflow available by default in non-production
// builds, while allowing CI/release builds to explicitly disable it.
const isDevAuthEnabled =
  isDevelopment && process.env.EXPO_PUBLIC_DEV_AUTH_ENABLED !== 'false';

export interface DevPersona {
  id: string;
  name: string;
  phone: string;
  role: 'host' | 'joiner' | 'unverified';
  trustScore: number;
  isVerified: boolean;
  interests: string[];
  gender: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
  birthDate: string;
}

export const DEV_PERSONAS: DevPersona[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Alex Rivera',
    phone: '+919876543210',
    role: 'host',
    trustScore: 4.95,
    isVerified: true,
    interests: ['football', 'badminton'],
    gender: 'male',
    birthDate: '1998-05-12',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Sam Chen',
    phone: '+919876543211',
    role: 'joiner',
    trustScore: 4.88,
    isVerified: true,
    interests: ['football', 'cafe_coffee'],
    gender: 'female',
    birthDate: '2000-08-22',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Priya Sharma',
    phone: '+919876543212',
    role: 'joiner',
    trustScore: 5.0,
    isVerified: true,
    interests: ['badminton', 'running_club'],
    gender: 'female',
    birthDate: '1997-11-04',
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Rohan Patel',
    phone: '+919876543213',
    role: 'unverified',
    trustScore: 3.8,
    isVerified: false,
    interests: ['board_games'],
    gender: 'male',
    birthDate: '2002-01-15',
  },
];

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
  } catch (err: any) {
    return { session: null, error: err?.message || 'Dev authentication failed' };
  }
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: ProfileState | null;
  isLoading: boolean;
  isDevMode: boolean;
  activePersonaId: string | null;

  // Actions
  initialize: () => Promise<void>;
  signInWithPhone: (phone: string) => Promise<{ error?: string }>;
  verifyOtp: (phone: string, token: string) => Promise<{ hasProfile: boolean; error?: string }>;
  upsertProfile: (input: UserProfileInput) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  loginWithPersona: (personaId: string) => Promise<void>;
}

let isAuthListenerRegistered = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isDevMode: isDevelopment,
  activePersonaId: null,

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
          isLoading: false,
        });
      } else if (isDevAuthEnabled) {
        // Cold start in development / demo mode:
        // Automatically default to the primary dev persona (Alex Rivera)
        // so cold starts have full profile context immediately (0ms).
        await get().loginWithPersona(DEV_PERSONAS[0]!.id);
      } else {
        set({ session: null, user: null, profile: null, isLoading: false });
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
              isLoading: false,
            });
          } else if (!get().activePersonaId) {
            set({ session: null, user: null, profile: null, isLoading: false });
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
    } catch (err: any) {
      set({ isLoading: false });
      return { error: err?.message || 'Failed to send OTP' };
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
      const matchedPersona = DEV_PERSONAS.find((p) => p.phone === phone);
      const { session, error } = await authenticateDevSession(
        phone,
        matchedPersona ? matchedPersona.name : undefined
      );

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
        activePersonaId: matchedPersona ? matchedPersona.id : null,
        isLoading: false,
      });

      return { hasProfile: !!profile };
    } catch (err: any) {
      set({ isLoading: false });
      return { hasProfile: false, error: err?.message || 'OTP verification failed' };
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
      const rawPhone = (user.phone || (user.user_metadata?.phone as string) || '').trim();
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

      const profilePayload = {
        id: user.id,
        phone: normalizedPhone,
        name: validated.name,
        birth_date: validated.birthDate,
        gender: validated.gender,
        interests: validated.interests,
        is_verified: false,
        trust_score: 5.0,
        interaction_count: 0,
        avatar_url: validated.avatarUrl || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(profilePayload)
        .select(PROFILE_COLUMNS)
        .single();

      set({ isLoading: false });

      if (error) {
        return { error: error.message };
      }

      set({ profile: data });
      return {};
    } catch (err: any) {
      set({ isLoading: false });
      return { error: err?.message || 'Failed to save profile' };
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
      activePersonaId: null,
    });
  },

  loginWithPersona: async (personaId: string) => {
    if (!isDevAuthEnabled) return; // Hard security lock: Persona switcher disabled in production

    const persona = DEV_PERSONAS.find((p) => p.id === personaId) || DEV_PERSONAS[0]!;

    // 1. Optimistic Local Hydration (0ms):
    // Populate profile and active persona immediately from DEV_PERSONAS so the UI never stalls.
    const optimisticProfile: ProfileState = {
      id: persona.id,
      name: persona.name,
      phone: persona.phone,
      birth_date: persona.birthDate,
      gender: persona.gender,
      interests: persona.interests,
      is_verified: persona.isVerified,
      trust_score: persona.trustScore,
      interaction_count: 5,
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set({
      activePersonaId: persona.id,
      profile: optimisticProfile,
      isLoading: false,
    });

    // 2. Establish authenticated Supabase session in the background
    const { session, error } = await authenticateDevSession(persona.phone, persona.name);
    if (error || !session) {
      console.warn('loginWithPersona dev session error:', error);
      return;
    }

    // 3. Ensure profile exists in Supabase database
    let { data: profile } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', session.user.id)
      .maybeSingle();

    if (!profile) {
      const { data: createdProfile } = await supabase
        .from('profiles')
        .insert({
          id: session.user.id,
          phone: persona.phone,
          name: persona.name,
          birth_date: persona.birthDate,
          gender: persona.gender,
          interests: persona.interests,
          is_verified: persona.isVerified,
          trust_score: persona.trustScore,
          interaction_count: 5,
        })
        .select(PROFILE_COLUMNS)
        .single();
      profile = createdProfile;
    }

    set({
      session,
      user: session.user,
      profile: profile || optimisticProfile,
      activePersonaId: persona.id,
      isLoading: false,
    });
  },
}));
