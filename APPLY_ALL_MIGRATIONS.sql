-- USA Filmhub Complete Database Setup
-- Run this in the Supabase SQL Editor

-- Step 1: Apply fresh start migration (main tables)
-- From 20251002120000_fresh_start.sql

-- Create users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text,
  role text NOT NULL DEFAULT 'filmmaker' CHECK (role IN ('admin', 'filmmaker', 'partner')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create content table
CREATE TABLE IF NOT EXISTS content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('movie', 'series', 'episode')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  owner_id uuid REFERENCES users(id) ON DELETE CASCADE,
  owner_email text,
  description text,
  duration integer,
  release_year integer,
  genre text,
  thumbnail_url text,
  video_url text,
  parent_id uuid REFERENCES content(id) ON DELETE CASCADE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Create title_distribution_settings table (for import script)
CREATE TABLE IF NOT EXISTS title_distribution_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid REFERENCES content(id) ON DELETE CASCADE,
  platform text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE title_distribution_settings ENABLE ROW LEVEL SECURITY;

-- Create streaming_payments table (for import script)
CREATE TABLE IF NOT EXISTS streaming_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid REFERENCES content(id) ON DELETE CASCADE,
  filmmaker_id uuid REFERENCES users(id) ON DELETE CASCADE,
  payment_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  platform text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE streaming_payments ENABLE ROW LEVEL SECURITY;

-- Create filmmaker_balances table (for import script)
CREATE TABLE IF NOT EXISTS filmmaker_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filmmaker_id uuid REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  total_earned numeric DEFAULT 0,
  total_paid numeric DEFAULT 0,
  available_balance numeric DEFAULT 0,
  last_updated timestamptz DEFAULT now()
);

ALTER TABLE filmmaker_balances ENABLE ROW LEVEL SECURITY;

-- Step 2: Create helper functions

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

  -- Insert user profile
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    user_role
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, users.name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Step 3: Create RLS policies

-- Users policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all users" ON users;
CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update any user" ON users;
CREATE POLICY "Admins can update any user"
  ON users FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Content policies
DROP POLICY IF EXISTS "Filmmakers can view own content" ON content;
CREATE POLICY "Filmmakers can view own content"
  ON content FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Partners can view approved content" ON content;
CREATE POLICY "Partners can view approved content"
  ON content FOR SELECT
  TO authenticated
  USING (status = 'approved' AND get_user_role() = 'partner');

DROP POLICY IF EXISTS "Admins can view all content" ON content;
CREATE POLICY "Admins can view all content"
  ON content FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Filmmakers can insert own content" ON content;
CREATE POLICY "Filmmakers can insert own content"
  ON content FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Filmmakers can update own content" ON content;
CREATE POLICY "Filmmakers can update own content"
  ON content FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR is_admin())
  WITH CHECK (owner_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Admins can update any content" ON content;
CREATE POLICY "Admins can update any content"
  ON content FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete any content" ON content;
CREATE POLICY "Admins can delete any content"
  ON content FOR DELETE
  TO authenticated
  USING (is_admin());

-- Policies for title_distribution_settings
DROP POLICY IF EXISTS "Admins can view all distribution settings" ON title_distribution_settings;
CREATE POLICY "Admins can view all distribution settings"
  ON title_distribution_settings FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage distribution settings" ON title_distribution_settings;
CREATE POLICY "Admins can manage distribution settings"
  ON title_distribution_settings FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Policies for streaming_payments
DROP POLICY IF EXISTS "Admins can view all streaming payments" ON streaming_payments;
CREATE POLICY "Admins can view all streaming payments"
  ON streaming_payments FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Filmmakers can view own streaming payments" ON streaming_payments;
CREATE POLICY "Filmmakers can view own streaming payments"
  ON streaming_payments FOR SELECT
  TO authenticated
  USING (filmmaker_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage streaming payments" ON streaming_payments;
CREATE POLICY "Admins can manage streaming payments"
  ON streaming_payments FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Policies for filmmaker_balances
DROP POLICY IF EXISTS "Admins can view all balances" ON filmmaker_balances;
CREATE POLICY "Admins can view all balances"
  ON filmmaker_balances FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Filmmakers can view own balance" ON filmmaker_balances;
CREATE POLICY "Filmmakers can view own balance"
  ON filmmaker_balances FOR SELECT
  TO authenticated
  USING (filmmaker_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage balances" ON filmmaker_balances;
CREATE POLICY "Admins can manage balances"
  ON filmmaker_balances FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_content_owner_id ON content(owner_id);
CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_type ON content(type);
CREATE INDEX IF NOT EXISTS idx_streaming_payments_filmmaker_id ON streaming_payments(filmmaker_id);
CREATE INDEX IF NOT EXISTS idx_streaming_payments_content_id ON streaming_payments(content_id);
CREATE INDEX IF NOT EXISTS idx_filmmaker_balances_filmmaker_id ON filmmaker_balances(filmmaker_id);
CREATE INDEX IF NOT EXISTS idx_title_distribution_settings_title_id ON title_distribution_settings(title_id);
