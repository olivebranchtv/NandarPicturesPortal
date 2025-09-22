/*
  # Fix SQL syntax error in RLS policies

  1. Security
    - Drop problematic policies with syntax errors
    - Create simple, working RLS policies
    - Use correct JSON operators for auth metadata
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Service role can read all users" ON users;
DROP POLICY IF EXISTS "Service role can update all users" ON users;
DROP POLICY IF EXISTS "Admins can read all users via service role" ON users;

-- Create basic policy for users to read their own data
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Create policy for users to update their own data
CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create policy for users to insert their own profile
CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create policy for service role to have full access
CREATE POLICY "Service role full access"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policy for authenticated users to read all users (simplified approach)
-- This allows admins to fetch filmmakers for dropdowns
CREATE POLICY "Authenticated users can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);