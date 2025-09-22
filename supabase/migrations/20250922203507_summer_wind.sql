/*
  # Initial Database Schema for Nandar Pictures Distribution Portal

  1. New Tables
    - `users` - User profiles for admins and filmmakers
    - `content` - Movies, series, and episodes content
    - `events` - Analytics events tracking
    - `runs` - Content distribution runs
    - `feed_logs` - Feed processing logs
    - `feed_profiles` - Feed profile configurations
    - `sessions_logs` - User session tracking
    - `train_logs` - Training/processing logs
    - `payment_requests` - Payment requests from filmmakers

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access
    - Admin emails get admin role automatically

  3. Functions
    - Auto-create user profiles on signup
    - Auto-assign roles based on email
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create content table (replaces titles)
CREATE TABLE IF NOT EXISTS content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_name text NOT NULL,
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

-- Create events table for analytics
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

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE train_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive RLS policies

-- Users policies
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Enable insert for authenticated users" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin policies for users table
CREATE POLICY "Admins can read all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Content policies
CREATE POLICY "Users can read approved content" ON content
  FOR SELECT USING (status = 'approved' OR owner_id = auth.uid() OR filmmaker_id = auth.uid());

CREATE POLICY "Filmmakers can insert content" ON content
  FOR INSERT WITH CHECK (filmmaker_id = auth.uid());

CREATE POLICY "Owners can update their content" ON content
  FOR UPDATE USING (owner_id = auth.uid() OR filmmaker_id = auth.uid());

-- Admin policies for content
CREATE POLICY "Admins can manage all content" ON content
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Events policies
CREATE POLICY "Users can read own events" ON events
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can insert events" ON events
  FOR INSERT WITH CHECK (true);

-- Runs policies
CREATE POLICY "Users can read runs for their content" ON runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM content c 
      WHERE c.id = runs.content_id 
      AND (c.owner_id = auth.uid() OR c.filmmaker_id = auth.uid())
    )
  );

-- Payment requests policies
CREATE POLICY "Filmmakers can read own payment requests" ON payment_requests
  FOR SELECT USING (filmmaker_id = auth.uid());

CREATE POLICY "Filmmakers can create payment requests" ON payment_requests
  FOR INSERT WITH CHECK (filmmaker_id = auth.uid());

-- Admin policies for payment requests
CREATE POLICY "Admins can manage all payment requests" ON payment_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Simple policies for other tables (admin only for now)
CREATE POLICY "Admins can manage feed_logs" ON feed_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage feed_profiles" ON feed_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage sessions_logs" ON sessions_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage train_logs" ON train_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Create function to handle user profile creation
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
    'info@olivebranchfilmstudios.com',
    'mail@nandarpictures.com'
  ) OR NEW.email LIKE '%@nandarpictures.com' THEN
    user_role := 'admin';
  END IF;

  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, user_role, now(), now());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_updated_at BEFORE UPDATE ON content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feed_profiles_updated_at BEFORE UPDATE ON feed_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_requests_updated_at BEFORE UPDATE ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample admin users (they will need to sign up first to create auth.users entries)
-- The trigger will automatically assign admin roles to these emails