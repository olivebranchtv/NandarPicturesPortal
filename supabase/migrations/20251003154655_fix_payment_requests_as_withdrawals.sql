/*
  # Fix Payment Requests as Withdrawals

  1. Changes
    - Update trigger to store payment requests as NEGATIVE amounts
    - This represents money going OUT to the filmmaker (withdrawal)
    - Revenue from platforms stays positive (money coming IN)

  2. Notes
    - Think of it like a checkbook register:
      - Deposits (platform revenue) = positive
      - Withdrawals (payments to filmmaker) = negative
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

  -- If status changed to 'paid', create a payment record with NEGATIVE amount
  -- This represents money going OUT to the filmmaker
  IF NEW.status = 'paid' AND (OLD IS NULL OR OLD.status != 'paid') THEN
    INSERT INTO payments (
      content_id,
      filmmaker_id,
      payment_date,
      gross_amount,
      distribution_fee,
      net_amount,
      channel,
      title_name,
      payment_method,
      notes
    )
    SELECT
      NEW.content_id,
      NEW.filmmaker_id,
      COALESCE(NEW.date_paid::date, CURRENT_DATE),
      -NEW.amount_approved,  -- NEGATIVE for withdrawal
      0,
      -NEW.amount_approved,  -- NEGATIVE for withdrawal
      'Payment Request',
      c.title_name,
      'payment_request',
      'Payment request fulfilled via ' || COALESCE(NEW.payment_method_used, 'Other')
    FROM content c
    WHERE c.id = NEW.content_id;
  END IF;
  
  -- Calculate total earned from streaming payments (positive amounts only)
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