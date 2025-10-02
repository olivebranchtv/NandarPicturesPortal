-- STEP 5: Create indexes and constraints

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_content_filmmaker_id ON content(filmmaker_id);
CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_type ON content(content_type);
CREATE INDEX IF NOT EXISTS idx_content_title_name ON content(LOWER(title_name));
CREATE INDEX IF NOT EXISTS idx_streaming_payments_filmmaker_id ON streaming_payments(filmmaker_id);
CREATE INDEX IF NOT EXISTS idx_streaming_payments_title_id ON streaming_payments(title_id);
CREATE INDEX IF NOT EXISTS idx_streaming_payments_content_id ON streaming_payments(content_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_filmmaker_id ON payment_requests(filmmaker_id);
CREATE INDEX IF NOT EXISTS idx_filmmaker_balances_filmmaker_id ON filmmaker_balances(filmmaker_id);
CREATE INDEX IF NOT EXISTS idx_title_distribution_settings_title_id ON title_distribution_settings(title_id);

ALTER TABLE content DROP CONSTRAINT IF EXISTS content_filmmaker_id_fkey;
ALTER TABLE content ADD CONSTRAINT content_filmmaker_id_fkey FOREIGN KEY (filmmaker_id) REFERENCES users(id) ON DELETE CASCADE;
