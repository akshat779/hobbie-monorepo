import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../services/supabase';
import { Database, UserProfileInput, UserProfileSchema } from '@hobbie/shared';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

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

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
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

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isDevMode: true,
  activePersonaId: null,

  initialize: async () => {
    try {
      set({ isLoading: true });

      // Check current session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        set({
          session,
          user: session.user,
          profile,
          isLoading: false,
        });
      } else {
        set({ session: null, user: null, profile: null, isLoading: false });
      }

      // Listen to Auth state changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
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

      // Dev fixed OTP bypass (123456)
      if (token === '123456') {
        const matchedPersona = DEV_PERSONAS.find((p) => p.phone === phone) || DEV_PERSONAS[0];
        const mockProfile: ProfileRow = {
          id: matchedPersona.id,
          phone: matchedPersona.phone,
          name: matchedPersona.name,
          birth_date: matchedPersona.birthDate,
          gender: matchedPersona.gender,
          interests: matchedPersona.interests,
          is_verified: matchedPersona.isVerified,
          trust_score: matchedPersona.trustScore,
          interaction_count: 5,
          avatar_url: null,
          last_location: null,
          coarse_geohash: null,
          last_active_at: new Date().toISOString(),
          expo_push_token: null,
          is_banned: false,
          banned_at: null,
          ban_reason: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        set({
          profile: mockProfile,
          user: { id: matchedPersona.id, phone: matchedPersona.phone } as User,
          activePersonaId: matchedPersona.id,
          isLoading: false,
        });

        return { hasProfile: true };
      }

      // Live Supabase OTP verification
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      });

      if (error) {
        set({ isLoading: false });
        return { hasProfile: false, error: error.message };
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        set({
          session: data.session,
          user: data.user,
          profile,
          isLoading: false,
        });

        return { hasProfile: !!profile };
      }

      set({ isLoading: false });
      return { hasProfile: false };
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

      set({ isLoading: true });

      const profilePayload = {
        id: user.id,
        phone: user.phone || '+919999999999',
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
        .select()
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
    const persona = DEV_PERSONAS.find((p) => p.id === personaId) || DEV_PERSONAS[0];
    const mockProfile: ProfileRow = {
      id: persona.id,
      phone: persona.phone,
      name: persona.name,
      birth_date: persona.birthDate,
      gender: persona.gender,
      interests: persona.interests,
      is_verified: persona.isVerified,
      trust_score: persona.trustScore,
      interaction_count: 5,
      avatar_url: null,
      last_location: null,
      coarse_geohash: null,
      last_active_at: new Date().toISOString(),
      expo_push_token: null,
      is_banned: false,
      banned_at: null,
      ban_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set({
      user: { id: persona.id, phone: persona.phone } as User,
      profile: mockProfile,
      activePersonaId: persona.id,
      isLoading: false,
    });
  },
}));
