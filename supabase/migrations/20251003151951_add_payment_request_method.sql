/*
  # Add payment_request to payment_method constraint

  1. Changes
    - Drop the existing check constraint on payment_method
    - Add new constraint that includes 'payment_request' as a valid option

  2. Notes
    - This allows payment records created from payment requests to be stored
*/

-- Drop the old constraint
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;

-- Add new constraint with payment_request included
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check 
  CHECK (payment_method = ANY (ARRAY['manual'::text, 'excel_upload'::text, 'payment_request'::text]));