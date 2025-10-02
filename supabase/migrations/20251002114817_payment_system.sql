/*
  # Payment System with Excel Upload Support

  1. New Tables
    - `payments` - Individual payment records from excel uploads or manual entry
      - `id` (uuid, primary key)
      - `content_id` (uuid, references content)
      - `filmmaker_id` (uuid, references users)
      - `payment_date` (date) - from column A
      - `gross_amount` (numeric) - from column B (original amount)
      - `distribution_fee` (numeric) - calculated 25% fee
      - `net_amount` (numeric) - amount filmmaker receives (75%)
      - `channel` (text) - from column H
      - `title_name` (text) - from column I for reference
      - `payment_method` (text) - 'excel_upload' or 'manual'
      - `notes` (text)
      - `created_by` (uuid, admin who created it)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `unassigned_content` - Temporary holding for titles from excel that don't match existing content
      - `id` (uuid, primary key)
      - `title_name` (text) - from column I
      - `payment_date` (date) - from column A
      - `gross_amount` (numeric) - from column B
      - `channel` (text) - from column H
      - `status` (text) - 'pending', 'assigned', 'ignored'
      - `assigned_content_id` (uuid, nullable)
      - `created_by` (uuid, admin who uploaded)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Updates to Existing Tables
    - Add indexes for better query performance on content title matching
    - Add payment summary fields to users table for quick dashboard access

  3. Security
    - Enable RLS on new tables
    - Admins can manage all payment records
    - Filmmakers can view their own payment history
    - Admins can manage unassigned content

  4. Functions
    - Function to calculate and update filmmaker earnings
    - Trigger to update content revenue totals when payments are added
*/

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

-- Add payment summary fields to users table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'total_earnings'
  ) THEN
    ALTER TABLE users ADD COLUMN total_earnings numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'total_payments_count'
  ) THEN
    ALTER TABLE users ADD COLUMN total_payments_count integer DEFAULT 0;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_filmmaker_id ON payments(filmmaker_id);
CREATE INDEX IF NOT EXISTS idx_payments_content_id ON payments(content_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_content_title_name_lower ON content(LOWER(title_name));
CREATE INDEX IF NOT EXISTS idx_unassigned_content_status ON unassigned_content(status);

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE unassigned_content ENABLE ROW LEVEL SECURITY;

-- Payments policies
CREATE POLICY "Admins can manage all payments"
  ON payments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Filmmakers can view their own payments"
  ON payments
  FOR SELECT
  TO authenticated
  USING (filmmaker_id = auth.uid());

-- Unassigned content policies
CREATE POLICY "Admins can manage unassigned content"
  ON unassigned_content
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Function to update filmmaker earnings summary
CREATE OR REPLACE FUNCTION update_filmmaker_earnings()
RETURNS trigger AS $$
BEGIN
  -- Update the filmmaker's total earnings and payment count
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update content revenue totals
CREATE OR REPLACE FUNCTION update_content_revenue()
RETURNS trigger AS $$
BEGIN
  -- Update the content's revenue totals
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for automatic updates
DROP TRIGGER IF EXISTS on_payment_insert_update_filmmaker ON payments;
CREATE TRIGGER on_payment_insert_update_filmmaker
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_filmmaker_earnings();

DROP TRIGGER IF EXISTS on_payment_insert_update_content ON payments;
CREATE TRIGGER on_payment_insert_update_content
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_content_revenue();

-- Trigger for updated_at on payments
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for updated_at on unassigned_content
DROP TRIGGER IF EXISTS update_unassigned_content_updated_at ON unassigned_content;
CREATE TRIGGER update_unassigned_content_updated_at
  BEFORE UPDATE ON unassigned_content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
