/*
  # Add Historical Accounting Fields to Content Table

  1. New Columns
    - `previous_gross_amount` (numeric) - Historical gross revenue from previous system
    - `previous_expenses` (numeric) - Historical expenses from previous system  
    - `previous_distribution_fee` (numeric) - Historical distribution fees from previous system
    - `previous_net_revenue` (numeric) - Historical net revenue from previous system
    - `previous_amount_paid` (numeric) - Historical amount paid to filmmakers from previous system
    - `previous_balance_due` (numeric) - Historical balance due to filmmakers from previous system

  2. Updates
    - Add default values of 0 for all new fields
    - Update existing records to have 0 values for historical fields
*/

-- Add historical accounting fields to content table
ALTER TABLE content 
ADD COLUMN IF NOT EXISTS previous_gross_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS previous_expenses numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS previous_distribution_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS previous_net_revenue numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS previous_amount_paid numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS previous_balance_due numeric DEFAULT 0;

-- Update existing records to have 0 values for historical fields
UPDATE content 
SET 
  previous_gross_amount = COALESCE(previous_gross_amount, 0),
  previous_expenses = COALESCE(previous_expenses, 0),
  previous_distribution_fee = COALESCE(previous_distribution_fee, 0),
  previous_net_revenue = COALESCE(previous_net_revenue, 0),
  previous_amount_paid = COALESCE(previous_amount_paid, 0),
  previous_balance_due = COALESCE(previous_balance_due, 0)
WHERE 
  previous_gross_amount IS NULL 
  OR previous_expenses IS NULL 
  OR previous_distribution_fee IS NULL 
  OR previous_net_revenue IS NULL 
  OR previous_amount_paid IS NULL 
  OR previous_balance_due IS NULL;