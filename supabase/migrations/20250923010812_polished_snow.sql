/*
  # Fix Distribution Settings Policies

  1. Security Updates
    - Update RLS policies for title_distribution_settings table
    - Allow admins to insert, update, and delete distribution settings
    - Ensure proper permissions for upsert operations

  2. Policy Changes
    - Add INSERT policy for admins
    - Add UPDATE policy for admins  
    - Add DELETE policy for admins
    - Maintain existing SELECT policy
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage distribution settings" ON title_distribution_settings;
DROP POLICY IF EXISTS "Filmmakers can read distribution settings for their content" ON title_distribution_settings;

-- Create comprehensive admin policies
CREATE POLICY "Admins can insert distribution settings"
  ON title_distribution_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update distribution settings"
  ON title_distribution_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete distribution settings"
  ON title_distribution_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can select distribution settings"
  ON title_distribution_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Filmmakers can read distribution settings for their content"
  ON title_distribution_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM content 
      WHERE content.id = title_distribution_settings.title_id 
      AND content.filmmaker_id = auth.uid()
    )
  );