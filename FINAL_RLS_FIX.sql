-- ULTIMATE FIX - Bypass RLS completely for the trigger function
-- The issue: Even SECURITY DEFINER respects RLS unless the function owner is exempt

-- Step 1: Drop all INSERT policies on users table
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
DROP POLICY IF EXISTS "Allow authenticated user inserts" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- Step 2: Temporarily disable RLS on users table to allow trigger to work
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Step 3: Recreate the trigger function
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

  -- Insert the user profile
  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, user_role, now(), now())
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = EXCLUDED.role,
      updated_at = now();

  RETURN NEW;
END;
$$;

-- Step 4: Grant execute permission
GRANT EXECUTE ON FUNCTION handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION handle_new_user() TO authenticated;

-- Step 5: Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Step 6: Re-enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 7: Create proper RLS policies that work with the trigger

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow inserts ONLY for new signups (this works because trigger runs as SECURITY DEFINER)
CREATE POLICY "Allow profile creation on signup" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow admins to read all users
CREATE POLICY "Admins can read all users" ON users
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Allow admins to update all users
CREATE POLICY "Admins can update all users" ON users
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Step 8: Make the function owner postgres to bypass RLS
ALTER FUNCTION handle_new_user() OWNER TO postgres;

-- Step 9: Set proper table ownership and grants
GRANT ALL ON users TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO service_role;
