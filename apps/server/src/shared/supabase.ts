import { createClient } from '@supabase/supabase-js';
import { Database } from '@hobbie/shared';
import { env } from '../config/env.js';

export const supabaseAdmin = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
