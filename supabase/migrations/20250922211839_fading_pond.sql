/*
  # Update Filmmaker Balance Function to Include Historical Data

  1. Function Updates
    - Modify the update_filmmaker_balance() function to include historical accounting data
    - Calculate total earned including previous amounts
    - Calculate total paid including previous payments
    - Update available balance to reflect historical data

  2. Trigger Updates
    - Ensure the function is called when content records are updated with historical data
*/

-- Drop existing function to recreate with updated logic
DROP FUNCTION IF EXISTS update_filmmaker_balance();

-- Create updated function that includes historical accounting data
CREATE OR REPLACE FUNCTION update_filmmaker_balance()
RETURNS TRIGGER AS $$
DECLARE
    filmmaker_user_id uuid;
    total_earned_amount numeric := 0;
    total_paid_amount numeric := 0;
    available_amount numeric := 0;
BEGIN
    -- Determine the filmmaker_id based on the trigger context
    IF TG_TABLE_NAME = 'streaming_payments' THEN
        -- Get filmmaker_id from the associated content
        SELECT c.filmmaker_id INTO filmmaker_user_id
        FROM content c
        WHERE c.id = COALESCE(NEW.title_id, OLD.title_id);
    ELSIF TG_TABLE_NAME = 'payment_requests' THEN
        filmmaker_user_id := COALESCE(NEW.filmmaker_id, OLD.filmmaker_id);
    ELSIF TG_TABLE_NAME = 'content' THEN
        filmmaker_user_id := COALESCE(NEW.filmmaker_id, OLD.filmmaker_id);
    END IF;

    -- Skip if no filmmaker_id found
    IF filmmaker_user_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Calculate total earned from streaming payments
    SELECT COALESCE(SUM(sp.net_amount), 0) INTO total_earned_amount
    FROM streaming_payments sp
    JOIN content c ON c.id = sp.title_id
    WHERE c.filmmaker_id = filmmaker_user_id;

    -- Add historical earnings from content records
    SELECT COALESCE(SUM(c.previous_net_revenue + c.previous_balance_due), 0) + total_earned_amount INTO total_earned_amount
    FROM content c
    WHERE c.filmmaker_id = filmmaker_user_id;

    -- Calculate total paid from payment requests
    SELECT COALESCE(SUM(pr.amount_approved), 0) INTO total_paid_amount
    FROM payment_requests pr
    WHERE pr.filmmaker_id = filmmaker_user_id 
    AND pr.status = 'paid';

    -- Add historical payments from content records
    SELECT COALESCE(SUM(c.previous_amount_paid), 0) + total_paid_amount INTO total_paid_amount
    FROM content c
    WHERE c.filmmaker_id = filmmaker_user_id;

    -- Calculate available balance
    available_amount := total_earned_amount - total_paid_amount;

    -- Insert or update filmmaker balance
    INSERT INTO filmmaker_balances (
        filmmaker_id,
        total_earned,
        total_paid,
        available_balance,
        last_updated
    ) VALUES (
        filmmaker_user_id,
        total_earned_amount,
        total_paid_amount,
        available_amount,
        NOW()
    )
    ON CONFLICT (filmmaker_id) 
    DO UPDATE SET
        total_earned = EXCLUDED.total_earned,
        total_paid = EXCLUDED.total_paid,
        available_balance = EXCLUDED.available_balance,
        last_updated = EXCLUDED.last_updated;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add trigger for content table updates to recalculate balances when historical data changes
DROP TRIGGER IF EXISTS update_filmmaker_balance_on_content_change ON content;
CREATE TRIGGER update_filmmaker_balance_on_content_change
    AFTER INSERT OR UPDATE OR DELETE ON content
    FOR EACH ROW
    EXECUTE FUNCTION update_filmmaker_balance();