/*
  # Fix RLS policies to prevent infinite recursion and allow filmmaker assignment

  1. Security Changes
    - Remove recursive policies that query users table from within users table policies
    - Create simple, non-recursive policies
    - Allow authenticated users to read user data (needed for filmmaker dropdowns)
    - Maintain write restrictions for security

  2. Policy Structure
    - Users can read all user profiles (needed for admin to see filmmakers)
    - Users can only update their own profile
    - Service role has full access for admin operations
*/

-- Drop all existing policies on users table to start fresh
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can select all users" ON users;
DROP POLICY IF EXISTS "Allow read for admin" ON users;
DROP POLICY IF EXISTS "Service role can read all users" ON users;
DROP POLICY IF EXISTS "Service role can update all users" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Create simple, non-recursive policies
CREATE POLICY "Allow authenticated users to read all profiles"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow users to insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow users to update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow service role full access for admin operations
CREATE POLICY "Allow service role full access"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);