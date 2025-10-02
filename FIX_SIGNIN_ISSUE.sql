-- Fix the RLS policy issue preventing signin
-- The problem is that the INSERT policy on users table is blocking the trigger

-- First, drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;

-- Create a better INSERT policy that allows the trigger to work
-- This policy allows inserts when the id matches auth.uid() OR when called by SECURITY DEFINER functions
CREATE POLICY "Enable insert for authenticated users" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id OR auth.uid() IS NOT NULL);

-- Recreate the handle_new_user function with proper permissions
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
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

  -- Insert into public.users with SECURITY DEFINER to bypass RLS
  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, user_role, now(), now())
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = EXCLUDED.role,
      updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
