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
    const environment = Deno.env.get('ENVIRONMENT') || 'development';
    if (environment === 'production') {
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
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = usersList?.users?.find(
      (u) => u.email === shadowEmail || u.phone === normalizedPhone
    );

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

    // 5. Ensure profile exists in public.profiles
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
          name: name || 'Hobbie Player',
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
