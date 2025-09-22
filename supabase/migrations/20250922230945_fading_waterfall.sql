/*
  # Fix RLS policies for authentication

  This migration fixes the RLS policies on the users table to allow:
  1. Users to read their own profile (required for authentication)
  2. Admins to read all users (for admin dashboard functionality)
  
  The previous policies were causing infinite recursion and blocking authentication.
*/

-- Drop all existing problematic policies
DROP POLICY IF EXISTS "Admin can select all users" ON users;
DROP POLICY IF EXISTS "Admins can select all users" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can select all users" ON users;
DROP POLICY IF EXISTS "Service role can read all users" ON users;
DROP POLICY IF EXISTS "Service role can update all users" ON users;
DROP POLICY IF EXISTS "Allow read for admin" ON users;

-- Create a simple policy that allows users to read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Create a policy for admins to read all users using a function approach
-- First, create a function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  );
$$;

-- Create admin policy using the function
CREATE POLICY "Admins can read all users via function" ON users
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow service role full access (for admin operations)
CREATE POLICY "Service role full access" ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);