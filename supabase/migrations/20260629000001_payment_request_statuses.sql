-- Extend payment_requests status to support processing and failed states
-- Existing statuses: pending, approved, rejected, paid
-- New statuses: processing (sent but not confirmed), failed (payment bounced/failed)

ALTER TABLE payment_requests
  DROP CONSTRAINT IF EXISTS payment_requests_status_check;

ALTER TABLE payment_requests
  ADD CONSTRAINT payment_requests_status_check
  CHECK (status IN ('pending', 'approved', 'processing', 'paid', 'failed', 'rejected'));
