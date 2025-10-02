-- ============================================
-- COPY THIS ENTIRE FILE AND PASTE IT INTO YOUR SUPABASE SQL EDITOR
-- Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/editor
-- Click "New Query", paste this, then click "Run"
-- ============================================

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

-- Create payment_statements table
CREATE TABLE IF NOT EXISTS payment_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filmmaker_id uuid REFERENCES users(id) ON DELETE CASCADE,
  filmmaker_email text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text DEFAULT 'USD',
  file_url text,
  notes text,
  uploaded_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_statements ENABLE ROW LEVEL SECURITY;

-- Create title_selections table
CREATE TABLE IF NOT EXISTS title_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES users(id) ON DELETE CASCADE,
  content_id uuid REFERENCES content(id) ON DELETE CASCADE,
  selected_at timestamptz DEFAULT now(),
  notes text,
  UNIQUE(partner_id, content_id)
);

ALTER TABLE title_selections ENABLE ROW LEVEL SECURITY;

-- Create analytics table
CREATE TABLE IF NOT EXISTS analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid REFERENCES content(id) ON DELETE CASCADE,
  views integer DEFAULT 0,
  revenue numeric(10,2) DEFAULT 0,
  period_start date,
  period_end date,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

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

-- RLS Policies for content table
CREATE POLICY "Filmmakers can view own content"
  ON content FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR is_admin());

CREATE POLICY "Partners can view approved content"
  ON content FOR SELECT
  TO authenticated
  USING (status = 'approved' AND get_user_role() = 'partner');

CREATE POLICY "Admins can view all content"
  ON content FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Filmmakers can insert own content"
  ON content FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() OR is_admin());

CREATE POLICY "Filmmakers can update own content"
  ON content FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR is_admin())
  WITH CHECK (owner_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can update any content"
  ON content FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete any content"
  ON content FOR DELETE
  TO authenticated
  USING (is_admin());

-- RLS Policies for payment_statements table
CREATE POLICY "Filmmakers can view own payments"
  ON payment_statements FOR SELECT
  TO authenticated
  USING (filmmaker_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can view all payments"
  ON payment_statements FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert payments"
  ON payment_statements FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update payments"
  ON payment_statements FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete payments"
  ON payment_statements FOR DELETE
  TO authenticated
  USING (is_admin());

-- RLS Policies for title_selections table
CREATE POLICY "Partners can view own selections"
  ON title_selections FOR SELECT
  TO authenticated
  USING (partner_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can view all selections"
  ON title_selections FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Partners can insert own selections"
  ON title_selections FOR INSERT
  TO authenticated
  WITH CHECK (partner_id = auth.uid());

CREATE POLICY "Partners can delete own selections"
  ON title_selections FOR DELETE
  TO authenticated
  USING (partner_id = auth.uid());

CREATE POLICY "Admins can manage all selections"
  ON title_selections FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- RLS Policies for analytics table
CREATE POLICY "Users can view analytics for own content"
  ON analytics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM content
      WHERE content.id = analytics.content_id
      AND content.owner_id = auth.uid()
    )
    OR is_admin()
  );

CREATE POLICY "Admins can view all analytics"
  ON analytics FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert analytics"
  ON analytics FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update analytics"
  ON analytics FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_content_owner_id ON content(owner_id);
CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_type ON content(type);
CREATE INDEX IF NOT EXISTS idx_payment_statements_filmmaker_id ON payment_statements(filmmaker_id);
CREATE INDEX IF NOT EXISTS idx_title_selections_partner_id ON title_selections(partner_id);
CREATE INDEX IF NOT EXISTS idx_title_selections_content_id ON title_selections(content_id);
CREATE INDEX IF NOT EXISTS idx_analytics_content_id ON analytics(content_id);
