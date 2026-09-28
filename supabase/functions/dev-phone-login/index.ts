// Supabase Edge Function: dev-phone-login
// Enables zero-SMS, cost-free development authentication and one-tap switching
// between real test accounts, by issuing authentic signed Supabase sessions.
//
// SECURITY MODEL (deny-by-default)
//   1. Hard kill-switch: the function refuses every request unless the server
//      secret DEV_AUTH_ALLOWED is explicitly the string "true". Production must
//      never set it, so the endpoint is inert by default.
//   2. Environment kill-switch: ENVIRONMENT=production always returns 403.
//   3. Session minting requires either an allowlisted phone (dev sign-up) or an
//      existing auth user id (dev account switching). Admin/service-role
//      credentials never leave the function runtime.
//
// This function is intentionally retained for local simulator / Maestro testing.

import {
  createClient,
  type SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRODUCTION_ENVIRONMENT = 'production';

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

/** Mints an authentic Supabase session for an existing auth user via magiclink. */
async function mintSessionForEmail(
  supabaseAdmin: SupabaseClient,
  email: string
): Promise<{ session: unknown; user: unknown }> {
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
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

  return { session: sessionData.session, user: sessionData.user };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Deny-by-default kill-switch: the endpoint is inert unless the server
    //    runtime explicitly opts in. Production never sets DEV_AUTH_ALLOWED.
    const devAuthAllowed = (readEnv('DEV_AUTH_ALLOWED') || '').trim().toLowerCase() === 'true';
    if (!devAuthAllowed) {
      return jsonResponse(
        { error: 'Dev authentication endpoint is disabled.' },
        403
      );
    }

    // 2. Environment kill-switch, independent of the opt-in secret.
    const environment = (readEnv('ENVIRONMENT') || '').trim().toLowerCase();
    if (environment === PRODUCTION_ENVIRONMENT) {
      return jsonResponse(
        { error: 'Dev authentication endpoint is strictly disabled in production.' },
        403
      );
    }

    const { phone, name, userId } = await req.json();

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

    // -----------------------------------------------------------------------
    // Mode A: mint a session for an existing auth user id (dev account switch).
    // -----------------------------------------------------------------------
    if (userId !== undefined) {
      if (typeof userId !== 'string' || !UUID_PATTERN.test(userId)) {
        return jsonResponse({ error: 'userId must be a valid UUID.' }, 400);
      }

      const { data: userData, error: userError } =
        await supabaseAdmin.auth.admin.getUserById(userId);

      if (userError || !userData?.user?.email) {
        return jsonResponse({ error: 'No switchable account found for that user id.' }, 404);
      }

      const { session, user } = await mintSessionForEmail(supabaseAdmin, userData.user.email);
      return jsonResponse({ session, user }, 200);
    }

    // -----------------------------------------------------------------------
    // Mode B: phone sign-in / sign-up (dev onboarding).
    // -----------------------------------------------------------------------
    if (!phone || typeof phone !== 'string') {
      return jsonResponse({ error: 'Valid phone number is required.' }, 400);
    }

    const normalizedPhone = phone.trim().startsWith('+')
      ? phone.trim()
      : `+${phone.trim()}`;
    if (!E164_PATTERN.test(normalizedPhone)) {
      return jsonResponse({ error: 'Phone number must be a valid E.164 number.' }, 400);
    }

    // Strict allowlist: server-side additions only. When no allowlist is
    // configured, any E.164 number is accepted (still gated by the
    // deny-by-default DEV_AUTH_ALLOWED secret above).
    const allowedPhones = readAdditionalAllowedPhones();
    if (allowedPhones.length > 0 && !allowedPhones.includes(normalizedPhone)) {
      return jsonResponse(
        { error: 'This development phone number is not allowlisted.' },
        403
      );
    }

    const phoneDigits = normalizedPhone.replace(/[^0-9]/g, '');
    const shadowEmail = `phone_${phoneDigits}@dev.hobbie.internal`;
    const devPassword = `HobbieDevPass_${phoneDigits}!`;

    // Ensure user exists in auth.users
    let userId2: string | null = null;
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
      userId2 = existingUser.id;
      // Ensure password and confirmation state are up to date
      await supabaseAdmin.auth.admin.updateUserById(userId2, {
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
      userId2 = newUser.user.id;
    }

    const { session, user } = await mintSessionForEmail(supabaseAdmin, shadowEmail);

    // If a name was explicitly provided, ensure the profile exists. For
    // brand-new users testing the sign-up flow, leave public.profiles empty so
    // they are correctly routed to onboarding (app/(auth)/interests.tsx).
    if (name) {
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', userId2)
        .maybeSingle();

      if (!existingProfile) {
        const { error: profileErr } = await supabaseAdmin.from('profiles').upsert(
          {
            id: userId2,
            phone: normalizedPhone,
            name: name,
            birth_date: '1998-01-01',
            gender: 'prefer-not-to-say',
            interests: ['football', 'badminton'],
            preferred_languages: ['en'],
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

    // Return genuine Supabase session containing real JWT
    return jsonResponse({ session, user }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Dev phone auth failed';
    return jsonResponse({ error: message }, 500);
  }
});
