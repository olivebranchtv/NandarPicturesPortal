/*
  # Fix RLS policies to use correct operator for role column

  1. Changes
    - Replace `role ->> 'admin'` with `role = 'admin'` 
    - The role column is text, not JSON, so we need to use = operator
    - Fix any policies that incorrectly use JSON operators on text columns

  2. Security
    - Maintain existing RLS security model
    - Allow admins to read all users
    - Allow users to read/update their own data
*/

-- Drop existing policies that have syntax errors
DROP POLICY IF EXISTS "Allow authenticated users to read all users" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Service role can read all users" ON users;
DROP POLICY IF EXISTS "Service role can update all users" ON users;

-- Create corrected policies using proper text comparison
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow admins to read all users (using correct text comparison)
CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin'
    )
  );

-- Service role policies for admin operations
CREATE POLICY "Service role can read all users"
  ON users
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can update all users"
  ON users
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);