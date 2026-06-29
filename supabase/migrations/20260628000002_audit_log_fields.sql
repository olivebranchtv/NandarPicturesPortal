-- Add approved_at timestamp and FK constraint for approved_by on payment_requests
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- approved_by already exists as a uuid column in some migrations but without FK
-- Add FK constraint if not already present (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'payment_requests'
      AND constraint_name = 'payment_requests_approved_by_fkey'
  ) THEN
    ALTER TABLE payment_requests
      ADD CONSTRAINT payment_requests_approved_by_fkey
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
