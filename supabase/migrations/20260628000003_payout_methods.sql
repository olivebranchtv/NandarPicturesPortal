-- Add preferred payout method and Zelle identifier to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'paypal'
    CHECK (payout_method IN ('paypal', 'venmo', 'zelle', 'stripe_ach', 'check', 'other')),
  ADD COLUMN IF NOT EXISTS zelle_identifier TEXT;

-- Add transaction reference to payment_requests for audit trail
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS transaction_reference TEXT;
