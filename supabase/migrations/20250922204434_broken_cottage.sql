/*
  # Add Payment Management System

  1. New Tables
    - `streaming_payments` - Records payments from streaming platforms
    - `title_distribution_settings` - Distribution percentage settings per title
    - `filmmaker_balances` - Calculated balances for filmmakers

  2. Security
    - Enable RLS on all new tables
    - Add policies for admin access and filmmaker read access

  3. Functions
    - Automatic balance calculation triggers
    - Net revenue calculation based on distribution percentages
*/

-- Create streaming_payments table
CREATE TABLE IF NOT EXISTS streaming_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid REFERENCES content(id) ON DELETE CASCADE,
  platform text NOT NULL,
  outlet text,
  payment_date date NOT NULL,
  gross_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  distribution_percentage numeric NOT NULL DEFAULT 50,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create title_distribution_settings table
CREATE TABLE IF NOT EXISTS title_distribution_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid REFERENCES content(id) ON DELETE CASCADE UNIQUE,
  company_percentage numeric NOT NULL DEFAULT 50,
  filmmaker_percentage numeric NOT NULL DEFAULT 50,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_percentages CHECK (company_percentage + filmmaker_percentage = 100)
);

-- Create filmmaker_balances table
CREATE TABLE IF NOT EXISTS filmmaker_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filmmaker_id uuid REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  total_earned numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  available_balance numeric NOT NULL DEFAULT 0,
  last_updated timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE streaming_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE title_distribution_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE filmmaker_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for streaming_payments
CREATE POLICY "Admins can manage streaming payments"
  ON streaming_payments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Filmmakers can read payments for their content"
  ON streaming_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM content 
      WHERE content.id = streaming_payments.title_id 
      AND content.filmmaker_id = auth.uid()
    )
  );

-- RLS Policies for title_distribution_settings
CREATE POLICY "Admins can manage distribution settings"
  ON title_distribution_settings
  FOR ALL
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

-- RLS Policies for filmmaker_balances
CREATE POLICY "Admins can manage filmmaker balances"
  ON filmmaker_balances
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Filmmakers can read own balance"
  ON filmmaker_balances
  FOR SELECT
  TO authenticated
  USING (filmmaker_id = auth.uid());

-- Function to calculate net amount based on distribution percentage
CREATE OR REPLACE FUNCTION calculate_net_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- Get distribution percentage for the title
  SELECT 
    COALESCE(tds.filmmaker_percentage, 50) INTO NEW.distribution_percentage
  FROM title_distribution_settings tds
  WHERE tds.title_id = NEW.title_id;
  
  -- If no distribution setting exists, create default 50/50 split
  IF NEW.distribution_percentage IS NULL THEN
    INSERT INTO title_distribution_settings (title_id, company_percentage, filmmaker_percentage)
    VALUES (NEW.title_id, 50, 50)
    ON CONFLICT (title_id) DO NOTHING;
    NEW.distribution_percentage := 50;
  END IF;
  
  -- Calculate net amount for filmmaker
  NEW.net_amount := NEW.gross_amount * (NEW.distribution_percentage / 100);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update filmmaker balance
CREATE OR REPLACE FUNCTION update_filmmaker_balance()
RETURNS TRIGGER AS $$
DECLARE
  filmmaker_id_var uuid;
  total_earned_var numeric;
  total_paid_var numeric;
BEGIN
  -- Get filmmaker ID from content
  SELECT c.filmmaker_id INTO filmmaker_id_var
  FROM content c
  WHERE c.id = COALESCE(NEW.title_id, OLD.title_id);
  
  IF filmmaker_id_var IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Calculate total earned from streaming payments
  SELECT COALESCE(SUM(sp.net_amount), 0) INTO total_earned_var
  FROM streaming_payments sp
  JOIN content c ON c.id = sp.title_id
  WHERE c.filmmaker_id = filmmaker_id_var;
  
  -- Calculate total paid from payment requests
  SELECT COALESCE(SUM(pr.amount_approved), 0) INTO total_paid_var
  FROM payment_requests pr
  WHERE pr.filmmaker_id = filmmaker_id_var
  AND pr.status = 'paid';
  
  -- Update or insert filmmaker balance
  INSERT INTO filmmaker_balances (filmmaker_id, total_earned, total_paid, available_balance, last_updated)
  VALUES (
    filmmaker_id_var,
    total_earned_var,
    total_paid_var,
    total_earned_var - total_paid_var,
    now()
  )
  ON CONFLICT (filmmaker_id) DO UPDATE SET
    total_earned = EXCLUDED.total_earned,
    total_paid = EXCLUDED.total_paid,
    available_balance = EXCLUDED.available_balance,
    last_updated = EXCLUDED.last_updated;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER calculate_net_amount_trigger
  BEFORE INSERT OR UPDATE ON streaming_payments
  FOR EACH ROW
  EXECUTE FUNCTION calculate_net_amount();

CREATE TRIGGER update_filmmaker_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON streaming_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_filmmaker_balance();

CREATE TRIGGER update_balance_on_payment_trigger
  AFTER UPDATE ON payment_requests
  FOR EACH ROW
  WHEN (OLD.status != NEW.status AND NEW.status = 'paid')
  EXECUTE FUNCTION update_filmmaker_balance();

-- Add updated_at triggers
CREATE TRIGGER update_streaming_payments_updated_at
  BEFORE UPDATE ON streaming_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_title_distribution_settings_updated_at
  BEFORE UPDATE ON title_distribution_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();