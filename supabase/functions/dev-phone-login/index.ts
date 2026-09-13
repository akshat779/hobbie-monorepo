// Supabase Edge Function: dev-phone-login
// Enables zero-SMS, cost-free phone authentication during development
// by creating real Supabase Auth identities and issuing authentic signed sessions.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Hard security guard: Disabled in production
    const environment = Deno.env.get('ENVIRONMENT');
    if (!environment || environment === 'production') {
      return new Response(
        JSON.stringify({ error: 'Dev authentication endpoint is strictly disabled in production.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phone, name } = await req.json();

    if (!phone || typeof phone !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid phone number is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedPhone = phone.trim().startsWith('+')
      ? phone.trim()
      : `+${phone.trim()}`;
    if (!/^\+[1-9]\d{1,14}$/.test(normalizedPhone)) {
      return new Response(
        JSON.stringify({ error: 'Phone number must be a valid E.164 number.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowedPhones = (Deno.env.get('DEV_AUTH_ALLOWED_PHONES') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (allowedPhones.length > 0 && !allowedPhones.includes(normalizedPhone)) {
      return new Response(
        JSON.stringify({ error: 'This development phone number is not allowlisted.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const phoneDigits = normalizedPhone.replace(/[^0-9]/g, '');
    const shadowEmail = `phone_${phoneDigits}@dev.hobbie.internal`;
    const devPassword = `HobbieDevPass_${phoneDigits}!`;

    // 2. Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase service role credentials not configured in Edge Function.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 3. Ensure user exists in auth.users
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

    // 4. Generate an authentic Supabase session using generateLink & verifyOtp
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

    // 5. If a name was explicitly provided (e.g. pre-configured Dev Persona), ensure profile exists.
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

    // 6. Return genuine Supabase session containing real JWT
    return new Response(
      JSON.stringify({
        session: sessionData.session,
        user: sessionData.user,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Dev phone auth failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
