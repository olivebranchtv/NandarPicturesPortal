-- USA Filmhub Complete Database Schema
-- This schema matches the application code exactly
-- Run this entire script in Supabase SQL Editor

-- Drop existing tables if they exist (be careful in production!)
DROP TABLE IF EXISTS analytics CASCADE;
DROP TABLE IF EXISTS title_selections CASCADE;
DROP TABLE IF EXISTS payment_statements CASCADE;
DROP TABLE IF EXISTS streaming_payments CASCADE;
DROP TABLE IF EXISTS title_distribution_settings CASCADE;
DROP TABLE IF EXISTS filmmaker_balances CASCADE;
DROP TABLE IF EXISTS payment_requests CASCADE;
DROP TABLE IF EXISTS content CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS get_user_role() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Create users table (with columns matching the code)
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  first_name text,
  last_name text,
  role text NOT NULL DEFAULT 'filmmaker' CHECK (role IN ('admin', 'filmmaker', 'partner')),
  total_earnings numeric DEFAULT 0,
  total_payments_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create content table (with columns matching the code)
CREATE TABLE content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_name text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('movie', 'series', 'episode')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  filmmaker_id uuid REFERENCES users(id) ON DELETE CASCADE,
  description text,
  duration_minutes integer,
  release_year integer,
  release_date text,
  genre text,
  rating text,
  thumbnail_url text,
  video_url text,
  parent_id uuid REFERENCES content(id) ON DELETE CASCADE,
  previous_gross_amount numeric DEFAULT 0,
  previous_expenses numeric DEFAULT 0,
  previous_distribution_fee numeric DEFAULT 0,
  previous_net_revenue numeric DEFAULT 0,
  previous_amount_paid numeric DEFAULT 0,
  previous_balance_due numeric DEFAULT 0,
  revenue_total numeric DEFAULT 0,
  distribution_fee numeric DEFAULT 0,
  net_revenue numeric DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Create title_distribution_settings table
CREATE TABLE title_distribution_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid REFERENCES content(id) ON DELETE CASCADE UNIQUE,
  company_percentage numeric NOT NULL DEFAULT 25,
  filmmaker_percentage numeric NOT NULL DEFAULT 75,
  platform text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE title_distribution_settings ENABLE ROW LEVEL SECURITY;

-- Create streaming_payments table
CREATE TABLE streaming_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid REFERENCES content(id) ON DELETE CASCADE,
  filmmaker_id uuid,
  content_id uuid REFERENCES content(id) ON DELETE CASCADE,
  payment_date date NOT NULL,
  gross_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  distribution_percentage numeric DEFAULT 25,
  platform text,
  outlet text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE streaming_payments ENABLE ROW LEVEL SECURITY;

-- Create payment_requests table
CREATE TABLE payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filmmaker_id uuid REFERENCES users(id) ON DELETE CASCADE,
  amount_requested numeric NOT NULL,
  amount_approved numeric,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  payment_method_used text,
  date_paid timestamptz,
  requested_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- Create filmmaker_balances table
CREATE TABLE filmmaker_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filmmaker_id uuid REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  total_earned numeric DEFAULT 0,
  total_paid numeric DEFAULT 0,
  available_balance numeric DEFAULT 0,
  last_updated timestamptz DEFAULT now()
);

ALTER TABLE filmmaker_balances ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND email IN (
      'nancycriss@yahoo.com',
      'sherri@olivebranch.tv',
      'nancy@olivebranch.tv',
      'info@olivebranchfilmstudios.com'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
BEGIN
  RETURN (SELECT role FROM users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  user_first_name text;
  user_last_name text;
BEGIN
  -- Determine role based on email
  IF NEW.email IN (
    'nancycriss@yahoo.com',
    'sherri@olivebranch.tv',
    'nancy@olivebranch.tv',
    'info@olivebranchfilmstudios.com'
  ) THEN
    user_role := 'admin';
  ELSE
    user_role := 'filmmaker';
  END IF;

  -- Extract name from metadata or use email
  user_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1));
  user_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');

  -- Insert user profile
  INSERT INTO public.users (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    user_first_name,
    user_last_name,
    user_role
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      first_name = COALESCE(EXCLUDED.first_name, users.first_name),
      last_name = COALESCE(EXCLUDED.last_name, users.last_name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS Policies for users table
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any user"
  ON users FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- RLS Policies for content table
CREATE POLICY "Filmmakers can view own content"
  ON content FOR SELECT
  TO authenticated
  USING (filmmaker_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can view all content"
  ON content FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Filmmakers can insert own content"
  ON content FOR INSERT
  TO authenticated
  WITH CHECK (filmmaker_id = auth.uid() OR is_admin());

CREATE POLICY "Filmmakers can update own content"
  ON content FOR UPDATE
  TO authenticated
  USING (filmmaker_id = auth.uid() OR is_admin())
  WITH CHECK (filmmaker_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can update any content"
  ON content FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete any content"
  ON content FOR DELETE
  TO authenticated
  USING (is_admin());

-- Policies for title_distribution_settings
CREATE POLICY "Admins can view all distribution settings"
  ON title_distribution_settings FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Filmmakers can view own title settings"
  ON title_distribution_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM content
      WHERE content.id = title_distribution_settings.title_id
      AND content.filmmaker_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage distribution settings"
  ON title_distribution_settings FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Policies for streaming_payments
CREATE POLICY "Admins can view all streaming payments"
  ON streaming_payments FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Filmmakers can view own streaming payments"
  ON streaming_payments FOR SELECT
  TO authenticated
  USING (filmmaker_id = auth.uid());

CREATE POLICY "Admins can manage streaming payments"
  ON streaming_payments FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Policies for payment_requests
CREATE POLICY "Filmmakers can view own payment requests"
  ON payment_requests FOR SELECT
  TO authenticated
  USING (filmmaker_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can view all payment requests"
  ON payment_requests FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Filmmakers can insert own payment requests"
  ON payment_requests FOR INSERT
  TO authenticated
  WITH CHECK (filmmaker_id = auth.uid());

CREATE POLICY "Admins can manage payment requests"
  ON payment_requests FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Policies for filmmaker_balances
CREATE POLICY "Admins can view all balances"
  ON filmmaker_balances FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Filmmakers can view own balance"
  ON filmmaker_balances FOR SELECT
  TO authenticated
  USING (filmmaker_id = auth.uid());

CREATE POLICY "Admins can manage balances"
  ON filmmaker_balances FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_content_filmmaker_id ON content(filmmaker_id);
CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_type ON content(content_type);
CREATE INDEX IF NOT EXISTS idx_content_title_name ON content(LOWER(title_name));
CREATE INDEX IF NOT EXISTS idx_streaming_payments_filmmaker_id ON streaming_payments(filmmaker_id);
CREATE INDEX IF NOT EXISTS idx_streaming_payments_title_id ON streaming_payments(title_id);
CREATE INDEX IF NOT EXISTS idx_streaming_payments_content_id ON streaming_payments(content_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_filmmaker_id ON payment_requests(filmmaker_id);
CREATE INDEX IF NOT EXISTS idx_filmmaker_balances_filmmaker_id ON filmmaker_balances(filmmaker_id);
CREATE INDEX IF NOT EXISTS idx_title_distribution_settings_title_id ON title_distribution_settings(title_id);

-- Add foreign key constraint name for the relationship query
ALTER TABLE content
  DROP CONSTRAINT IF EXISTS content_filmmaker_id_fkey,
  ADD CONSTRAINT content_filmmaker_id_fkey
    FOREIGN KEY (filmmaker_id)
    REFERENCES users(id)
    ON DELETE CASCADE;
