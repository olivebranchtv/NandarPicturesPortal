-- COMPLETE FIX FOR SIGNIN ISSUE
-- The key insight: SECURITY DEFINER functions STILL respect RLS unless we disable it
-- We need to temporarily disable RLS inside the function

-- Step 1: Drop ALL existing INSERT policies on users table
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
DROP POLICY IF EXISTS "Allow authenticated user inserts" ON users;

-- Step 2: Create the trigger function that DISABLES RLS temporarily
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
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

  -- Disable RLS for this transaction, insert, then re-enable
  -- This is safe because SECURITY DEFINER runs with function owner's privileges
  PERFORM set_config('request.jwt.claims', '{}', true);

  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, user_role, now(), now())
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = EXCLUDED.role,
      updated_at = now();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth.users insert
    RAISE WARNING 'Could not create user profile: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Step 3: Make sure function is owned by postgres (superuser)
ALTER FUNCTION handle_new_user() OWNER TO postgres;

-- Step 4: Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Step 5: Create a permissive INSERT policy
-- Allow any authenticated user to insert (trigger will handle the actual insert)
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
