-- 20260830000005_add_profile_insert_policy.sql
-- Allow authenticated users to insert their own profile record (e.g., during onboarding or initial login)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polrelid = 'public.profiles'::regclass 
      AND polname = 'Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;
