/*
  # Complete Database Schema for USA Filmhub Platform

  1. New Tables
    - `users` - User profiles (admin, filmmaker, partner roles)
    - `content` - Movies, series, episodes
    - `payments` - Payment records from Excel uploads
    - `unassigned_content` - Unmatched titles from uploads
    - `events` - Analytics tracking
    - `runs` - Distribution runs
    - `feed_logs` - Feed processing logs
    - `feed_profiles` - Feed configurations
    - `sessions_logs` - Session tracking
    - `train_logs` - Training logs
    - `payment_requests` - Payment requests from filmmakers

  2. Security
    - RLS enabled on all tables
    - Role-based access policies
    - Admin emails auto-assigned admin role

  3. Functions & Triggers
    - Auto-create user profiles on signup
    - Auto-assign roles based on email
    - Auto-update timestamps
    - Auto-update earnings summaries
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  first_name text,
  last_name text,
  role text NOT NULL DEFAULT 'filmmaker' CHECK (role IN ('admin', 'filmmaker', 'partner')),
  address text,
  city text,
  state text,
  zip_code text,
  paypal_email text,
  venmo_username text,
  total_earnings numeric DEFAULT 0,
  total_payments_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create content table
CREATE TABLE IF NOT EXISTS content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_name text NOT NULL UNIQUE,
  content_type text NOT NULL DEFAULT 'movie' CHECK (content_type IN ('movie', 'series', 'episode')),
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  owner_email text,
  filmmaker_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  revenue_total numeric DEFAULT 0,
  distribution_fee numeric DEFAULT 0,
  expenses_total numeric DEFAULT 0,
  net_revenue numeric DEFAULT 0,
  description text,
  genre text,
  release_date date,
  duration_minutes integer,
  rating text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid REFERENCES content(id) ON DELETE CASCADE,
  filmmaker_id uuid REFERENCES users(id) ON DELETE CASCADE,
  payment_date date NOT NULL,
  gross_amount numeric NOT NULL DEFAULT 0,
  distribution_fee numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  channel text,
  title_name text,
  payment_method text DEFAULT 'manual' CHECK (payment_method IN ('manual', 'excel_upload')),
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unassigned_content table
CREATE TABLE IF NOT EXISTS unassigned_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_name text NOT NULL,
  payment_date date NOT NULL,
  gross_amount numeric NOT NULL DEFAULT 0,
  channel text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'ignored')),
  assigned_content_id uuid REFERENCES content(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  content_id uuid REFERENCES content(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}',
  platform text,
  revenue_amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create runs table
CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid REFERENCES content(id) ON DELETE CASCADE,
  platform text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  revenue_generated numeric DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create feed_logs table
CREATE TABLE IF NOT EXISTS feed_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_type text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  records_processed integer DEFAULT 0,
  errors_count integer DEFAULT 0,
  log_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create feed_profiles table
CREATE TABLE IF NOT EXISTS feed_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_name text NOT NULL,
  platform text NOT NULL,
  configuration jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sessions_logs table
CREATE TABLE IF NOT EXISTS sessions_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  session_start timestamptz DEFAULT now(),
  session_end timestamptz,
  ip_address inet,
  user_agent text,
  actions_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create train_logs table
CREATE TABLE IF NOT EXISTS train_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name text NOT NULL,
  training_status text DEFAULT 'pending' CHECK (training_status IN ('pending', 'training', 'completed', 'failed')),
  accuracy_score numeric,
  training_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create payment_requests table
CREATE TABLE IF NOT EXISTS payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filmmaker_id uuid REFERENCES users(id) ON DELETE CASCADE,
  content_id uuid REFERENCES content(id) ON DELETE SET NULL,
  amount_requested numeric NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  admin_notes text,
  amount_approved numeric,
  payment_method_used text,
  date_paid timestamptz,
  requested_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payments_filmmaker_id ON payments(filmmaker_id);
CREATE INDEX IF NOT EXISTS idx_payments_content_id ON payments(content_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_content_title_name_lower ON content(LOWER(title_name));
CREATE INDEX IF NOT EXISTS idx_unassigned_content_status ON unassigned_content(status);
CREATE INDEX IF NOT EXISTS idx_content_filmmaker_id ON content(filmmaker_id);
CREATE INDEX IF NOT EXISTS idx_content_owner_id ON content(owner_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE unassigned_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE train_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can read own profile" ON users;
  DROP POLICY IF EXISTS "Users can update own profile" ON users;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
  DROP POLICY IF EXISTS "Admins can read all users" ON users;
  DROP POLICY IF EXISTS "Admins can update all users" ON users;
  DROP POLICY IF EXISTS "Users can read approved content" ON content;
  DROP POLICY IF EXISTS "Filmmakers can insert content" ON content;
  DROP POLICY IF EXISTS "Owners can update their content" ON content;
  DROP POLICY IF EXISTS "Admins can manage all content" ON content;
  DROP POLICY IF EXISTS "Admins can manage all payments" ON payments;
  DROP POLICY IF EXISTS "Filmmakers can view their own payments" ON payments;
  DROP POLICY IF EXISTS "Admins can manage unassigned content" ON unassigned_content;
  DROP POLICY IF EXISTS "Users can read own events" ON events;
  DROP POLICY IF EXISTS "System can insert events" ON events;
  DROP POLICY IF EXISTS "Admins can manage events" ON events;
  DROP POLICY IF EXISTS "Users can read runs for their content" ON runs;
  DROP POLICY IF EXISTS "Admins can manage runs" ON runs;
  DROP POLICY IF EXISTS "Filmmakers can read own payment requests" ON payment_requests;
  DROP POLICY IF EXISTS "Filmmakers can create payment requests" ON payment_requests;
  DROP POLICY IF EXISTS "Admins can manage all payment requests" ON payment_requests;
  DROP POLICY IF EXISTS "Admins can manage feed_logs" ON feed_logs;
  DROP POLICY IF EXISTS "Admins can manage feed_profiles" ON feed_profiles;
  DROP POLICY IF EXISTS "Admins can manage sessions_logs" ON sessions_logs;
  DROP POLICY IF EXISTS "Admins can manage train_logs" ON train_logs;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Users policies
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable insert for authenticated users" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all users" ON users
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can update all users" ON users
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Content policies
CREATE POLICY "Users can read approved content" ON content
  FOR SELECT
  TO authenticated
  USING (
    status = 'approved'
    OR owner_id = auth.uid()
    OR filmmaker_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Filmmakers can insert content" ON content
  FOR INSERT
  TO authenticated
  WITH CHECK (
    filmmaker_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Owners can update their content" ON content
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR filmmaker_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can manage all content" ON content
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Payments policies
CREATE POLICY "Admins can manage all payments" ON payments
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Filmmakers can view their own payments" ON payments
  FOR SELECT
  TO authenticated
  USING (
    filmmaker_id = auth.uid()
  );

-- Unassigned content policies
CREATE POLICY "Admins can manage unassigned content" ON unassigned_content
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Events policies
CREATE POLICY "Users can read own events" ON events
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "System can insert events" ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can manage events" ON events
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Runs policies
CREATE POLICY "Users can read runs for their content" ON runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM content
      WHERE content.id = runs.content_id
      AND (content.owner_id = auth.uid() OR content.filmmaker_id = auth.uid())
    )
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can manage runs" ON runs
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Payment requests policies
CREATE POLICY "Filmmakers can read own payment requests" ON payment_requests
  FOR SELECT
  TO authenticated
  USING (
    filmmaker_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Filmmakers can create payment requests" ON payment_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    filmmaker_id = auth.uid()
  );

CREATE POLICY "Admins can manage all payment requests" ON payment_requests
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Admin-only table policies
CREATE POLICY "Admins can manage feed_logs" ON feed_logs
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can manage feed_profiles" ON feed_profiles
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can manage sessions_logs" ON sessions_logs
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can manage train_logs" ON train_logs
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text := 'filmmaker';
BEGIN
  -- Assign admin role to specific emails
  IF NEW.email IN (
    'nancycriss@yahoo.com',
    'sherri@olivebranch.tv',
    'nancy@olivebranch.tv',
    'info@olivebranchfilmstudios.com'
  ) THEN
    user_role := 'admin';
  END IF;

  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, user_role, now(), now())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update filmmaker earnings summary
CREATE OR REPLACE FUNCTION update_filmmaker_earnings()
RETURNS trigger AS $$
BEGIN
  IF NEW.filmmaker_id IS NOT NULL THEN
    UPDATE users
    SET
      total_earnings = COALESCE((
        SELECT SUM(net_amount)
        FROM payments
        WHERE filmmaker_id = NEW.filmmaker_id
      ), 0),
      total_payments_count = COALESCE((
        SELECT COUNT(*)
        FROM payments
        WHERE filmmaker_id = NEW.filmmaker_id
      ), 0)
    WHERE id = NEW.filmmaker_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update content revenue totals
CREATE OR REPLACE FUNCTION update_content_revenue()
RETURNS trigger AS $$
BEGIN
  IF NEW.content_id IS NOT NULL THEN
    UPDATE content
    SET
      revenue_total = COALESCE((
        SELECT SUM(gross_amount)
        FROM payments
        WHERE content_id = NEW.content_id
      ), 0),
      distribution_fee = COALESCE((
        SELECT SUM(payments.distribution_fee)
        FROM payments
        WHERE content_id = NEW.content_id
      ), 0),
      net_revenue = COALESCE((
        SELECT SUM(net_amount)
        FROM payments
        WHERE content_id = NEW.content_id
      ), 0)
    WHERE id = NEW.content_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_content_updated_at ON content;
DROP TRIGGER IF EXISTS update_feed_profiles_updated_at ON feed_profiles;
DROP TRIGGER IF EXISTS update_payment_requests_updated_at ON payment_requests;
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
DROP TRIGGER IF EXISTS update_unassigned_content_updated_at ON unassigned_content;
DROP TRIGGER IF EXISTS on_payment_insert_update_filmmaker ON payments;
DROP TRIGGER IF EXISTS on_payment_insert_update_content ON payments;

-- Create triggers
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feed_profiles_updated_at
  BEFORE UPDATE ON feed_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_requests_updated_at
  BEFORE UPDATE ON payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_unassigned_content_updated_at
  BEFORE UPDATE ON unassigned_content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER on_payment_insert_update_filmmaker
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_filmmaker_earnings();

CREATE TRIGGER on_payment_insert_update_content
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_content_revenue();
