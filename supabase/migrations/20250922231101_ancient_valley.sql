/*
  # Fix RLS infinite recursion issues

  This migration completely removes problematic RLS policies and creates simple, non-recursive ones.

  1. Drop all existing policies that cause recursion
  2. Create simple policies that don't reference the users table from within itself
  3. Use service role for admin operations to bypass RLS when needed
*/

-- Drop all existing policies on users table to start fresh
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can select all users" ON users;
DROP POLICY IF EXISTS "Service role can read all users" ON users;
DROP POLICY IF EXISTS "Service role can update all users" ON users;
DROP POLICY IF EXISTS "Allow read for admin" ON users;
DROP POLICY IF EXISTS "Admin can select all users" ON users;

-- Drop the helper function if it exists
DROP FUNCTION IF EXISTS is_admin();

-- Create very simple policies that avoid recursion
CREATE POLICY "Enable read access for own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Enable insert for authenticated users" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for own data" ON users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Create a policy for service role to bypass RLS completely
CREATE POLICY "Service role full access" ON users
  FOR ALL USING (current_setting('role') = 'service_role');

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;