/*
  # Fix Payment Request Trigger Function
  
  1. Changes
    - Update update_filmmaker_balance() function to use content_id instead of title_id
    - The payment_requests table uses content_id, not title_id
  
  2. Notes
    - This fixes the error when marking payments as paid
*/

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
  WHERE c.id = COALESCE(NEW.content_id, OLD.content_id);
  
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