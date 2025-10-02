-- FIX SIGNIN ISSUE - Clean approach without duplicating policies
-- This addresses the RLS blocking the trigger function

-- Step 1: Drop ALL existing INSERT policies on users table
DO $$
BEGIN
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
  DROP POLICY IF EXISTS "Allow authenticated user inserts" ON users;
  DROP POLICY IF EXISTS "Users can insert own profile" ON users;
  DROP POLICY IF EXISTS "Allow profile creation on signup" ON users;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Step 2: Temporarily disable RLS on users table
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Step 3: Recreate the trigger function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text := 'filmmaker';
BEGIN
  -- Assign admin role to specific emails
  IF NEW.email IN (
    'nancycriss@yahoo.com',
    'sherri@olivebranch.tv',
    'nancy@olivebranch.tv',
    'info@olivebranchfilmstudios.com'
  ) THEN
    user_role := 'admin';
  END IF;

  -- Insert the user profile (RLS is disabled so this will work)
  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, user_role, now(), now())
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = EXCLUDED.role,
      updated_at = now();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the auth.users insert if profile creation fails
    RAISE WARNING 'Failed to create user profile: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Step 4: Ensure function is owned by postgres (superuser)
ALTER FUNCTION handle_new_user() OWNER TO postgres;

-- Step 5: Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Step 6: Re-enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 7: Create a new INSERT policy that allows profile creation
CREATE POLICY "Allow profile creation on signup" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Step 8: Grant necessary permissions
GRANT ALL ON users TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO service_role;
