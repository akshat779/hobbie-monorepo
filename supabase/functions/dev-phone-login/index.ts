// Supabase Edge Function: dev-phone-login
// Enables zero-SMS, cost-free phone authentication during development
// by creating real Supabase Auth identities and issuing authentic signed sessions.
//
// SECURITY MODEL
//   1. Hard production kill-switch: ENVIRONMENT=production always returns 403.
//   2. Strict phone allowlist: only the mock developer personas (and any phones
//      explicitly added server-side via DEV_AUTH_ALLOWED_PHONES) can obtain a
//      session. Arbitrary E.164 numbers are rejected with 403.
//
// This function is intentionally retained for local simulator / Maestro testing.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;
const PRODUCTION_ENVIRONMENT = 'production';

/**
 * Strict baseline allowlist. Must stay in sync with DEV_PERSONAS in
 * apps/mobile/src/features/auth/useAuthStore.ts.
 */
const DEV_PERSONA_PHONES: readonly string[] = [
  '+919876543210', // Alex Rivera  (host)
  '+919876543211', // Sam Chen     (joiner)
  '+919876543212', // Priya Sharma (joiner)
  '+919876543213', // Rohan Patel  (unverified)
];

/**
 * Reads an environment variable in both Deno and Node-compatible runtimes.
 */
function readEnv(key: string): string | undefined {
  try {
    if (typeof Deno !== 'undefined' && Deno.env && typeof Deno.env.get === 'function') {
      const value = Deno.env.get(key);
      if (value !== undefined) return value;
    }
  } catch {
    // Ignore Deno permission errors and fall through to process.env.
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

/** Server-side configurable additions, never caller-controlled. */
function readAdditionalAllowedPhones(): string[] {
  return (readEnv('DEV_AUTH_ALLOWED_PHONES') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Hard security guard: production is always terminated before any work.
    const environment = (readEnv('ENVIRONMENT') || '').trim().toLowerCase();
    if (environment === PRODUCTION_ENVIRONMENT) {
      return jsonResponse(
        { error: 'Dev authentication endpoint is strictly disabled in production.' },
        403
      );
    }

    const { phone, name } = await req.json();

    if (!phone || typeof phone !== 'string') {
      return jsonResponse({ error: 'Valid phone number is required.' }, 400);
    }

    const normalizedPhone = phone.trim().startsWith('+')
      ? phone.trim()
      : `+${phone.trim()}`;
    if (!E164_PATTERN.test(normalizedPhone)) {
      return jsonResponse({ error: 'Phone number must be a valid E.164 number.' }, 400);
    }

    // 2. Strict allowlist: developer personas plus server-side additions only.
    const allowedPhones = Array.from(
      new Set([...DEV_PERSONA_PHONES, ...readAdditionalAllowedPhones()])
    );
    if (!allowedPhones.includes(normalizedPhone)) {
      return jsonResponse(
        { error: 'This development phone number is not allowlisted.' },
        403
      );
    }

    const phoneDigits = normalizedPhone.replace(/[^0-9]/g, '');
    const shadowEmail = `phone_${phoneDigits}@dev.hobbie.internal`;
    const devPassword = `HobbieDevPass_${phoneDigits}!`;

    // 3. Initialize Supabase Admin Client
    const supabaseUrl = readEnv('SUPABASE_URL');
    const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { error: 'Supabase service role credentials not configured in Edge Function.' },
        500
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 4. Ensure user exists in auth.users
    let userId: string | null = null;
    let existingUser;
    for (let page = 1; page <= 100 && !existingUser; page += 1) {
      const { data: usersList, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 100,
      });
      if (usersError) throw usersError;
      existingUser = usersList.users.find(
        (u) => u.email === shadowEmail || u.phone === normalizedPhone
      );
      if (usersList.users.length < 100) break;
    }

    if (existingUser) {
      userId = existingUser.id;
      // Ensure password and confirmation state are up to date
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: devPassword,
        email_confirm: true,
        phone_confirm: true,
      });
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: shadowEmail,
        phone: normalizedPhone,
        password: devPassword,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          name: name || 'Hobbie Player',
          phone: normalizedPhone,
        },
      });

      if (createError || !newUser.user) {
        throw createError || new Error('Failed to create auth user');
      }
      userId = newUser.user.id;
    }

    // 5. Generate an authentic Supabase session using generateLink & verifyOtp
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: shadowEmail,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      throw linkError || new Error('Failed to generate magiclink token');
    }

    const { data: sessionData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });

    if (verifyError || !sessionData.session) {
      throw verifyError || new Error('Failed to verify token for session');
    }

    // 6. If a name was explicitly provided (e.g. pre-configured Dev Persona), ensure profile exists.
    // For brand-new users testing the sign-up flow, leave public.profiles empty so they
    // are correctly routed to the onboarding screen (app/(auth)/interests.tsx).
    if (name) {
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (!existingProfile) {
        const { error: profileErr } = await supabaseAdmin.from('profiles').upsert(
          {
            id: userId,
            phone: normalizedPhone,
            name: name,
            birth_date: '1998-01-01',
            gender: 'prefer-not-to-say',
            interests: ['football', 'badminton'],
            is_verified: true,
            trust_score: 5.0,
            interaction_count: 5,
          },
          { onConflict: 'id' }
        );
        if (profileErr) {
          console.error('Profile upsert error in dev-phone-login:', profileErr.message);
        }
      }
    }

    // 7. Return genuine Supabase session containing real JWT
    return jsonResponse(
      {
        session: sessionData.session,
        user: sessionData.user,
      },
      200
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Dev phone auth failed';
    return jsonResponse({ error: message }, 500);
  }
});