-- Add audit log fields to payment_requests
-- Run this in the Supabase SQL editor

ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_payment_requests_approved_by ON payment_requests(approved_by);
