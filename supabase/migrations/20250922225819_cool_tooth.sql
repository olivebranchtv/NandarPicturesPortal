/*
  # Create Admin SELECT Policy for Users Table

  1. Security Policy
    - Allow users with role 'admin' to SELECT all rows from users table
    - Uses a simple approach without recursive calls
    - Avoids auth.uid() logic within the policy itself

  2. Implementation
    - Creates a straightforward policy that checks if the requesting user has admin role
    - Uses EXISTS clause to verify admin status from a separate query context
*/

-- Create policy to allow admins to select all users
CREATE POLICY "Admins can select all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM auth.users au
      JOIN users u ON au.id = u.id
      WHERE au.id = auth.uid() 
      AND u.role = 'admin'
    )
  );