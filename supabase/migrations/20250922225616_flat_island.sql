/*
  # Create RLS policy for admin users to select all users

  1. Security Changes
    - Add policy "Admins can read all users" on `users` table
    - Allow SELECT access for users with role = 'admin'
    - This enables admins to fetch filmmakers for the dropdown

  2. Policy Details
    - Policy name: "Admins can read all users"
    - Operation: SELECT
    - Target: authenticated users
    - Condition: Current user has role = 'admin'
*/

-- Create policy to allow admins to read all users
CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin'
    )
  );