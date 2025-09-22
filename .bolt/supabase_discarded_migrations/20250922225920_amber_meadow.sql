/*
  # Fix infinite recursion in admin RLS policy

  1. Policy Changes
    - Drop the problematic recursive policy
    - Create a new policy that uses auth.jwt() to check user role
    - Avoids querying the users table from within the users table policy

  2. Security
    - Maintains admin access to all user records
    - Uses JWT metadata instead of table lookup to prevent recursion
*/

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Admins can select all users" ON users;

-- Create a new policy that uses JWT metadata to avoid recursion
-- This assumes the user's role is stored in the JWT user_metadata
CREATE POLICY "Admins can select all users via JWT"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin') OR
    (auth.uid() = id)
  );