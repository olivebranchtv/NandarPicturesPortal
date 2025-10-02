-- STEP 2: Create tables

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

CREATE TABLE filmmaker_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filmmaker_id uuid REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  total_earned numeric DEFAULT 0,
  total_paid numeric DEFAULT 0,
  available_balance numeric DEFAULT 0,
  last_updated timestamptz DEFAULT now()
);

ALTER TABLE filmmaker_balances ENABLE ROW LEVEL SECURITY;
