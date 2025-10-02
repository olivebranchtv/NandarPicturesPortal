-- STEP 4: Create RLS Policies

-- Users policies
CREATE POLICY "Users can view own profile" ON users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can view all users" ON users FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Users can update own profile" ON users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can update any user" ON users FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can insert users" ON users FOR INSERT TO authenticated WITH CHECK (is_admin());

-- Content policies
CREATE POLICY "Filmmakers can view own content" ON content FOR SELECT TO authenticated USING (filmmaker_id = auth.uid() OR is_admin());
CREATE POLICY "Admins can view all content" ON content FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Filmmakers can insert own content" ON content FOR INSERT TO authenticated WITH CHECK (filmmaker_id = auth.uid() OR is_admin());
CREATE POLICY "Filmmakers can update own content" ON content FOR UPDATE TO authenticated USING (filmmaker_id = auth.uid() OR is_admin()) WITH CHECK (filmmaker_id = auth.uid() OR is_admin());
CREATE POLICY "Admins can update any content" ON content FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can delete any content" ON content FOR DELETE TO authenticated USING (is_admin());

-- Title distribution settings policies
CREATE POLICY "Admins can view all distribution settings" ON title_distribution_settings FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Filmmakers can view own title settings" ON title_distribution_settings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM content WHERE content.id = title_distribution_settings.title_id AND content.filmmaker_id = auth.uid()));
CREATE POLICY "Admins can manage distribution settings" ON title_distribution_settings FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Streaming payments policies
CREATE POLICY "Admins can view all streaming payments" ON streaming_payments FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Filmmakers can view own streaming payments" ON streaming_payments FOR SELECT TO authenticated USING (filmmaker_id = auth.uid());
CREATE POLICY "Admins can manage streaming payments" ON streaming_payments FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Payment requests policies
CREATE POLICY "Filmmakers can view own payment requests" ON payment_requests FOR SELECT TO authenticated USING (filmmaker_id = auth.uid() OR is_admin());
CREATE POLICY "Admins can view all payment requests" ON payment_requests FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Filmmakers can insert own payment requests" ON payment_requests FOR INSERT TO authenticated WITH CHECK (filmmaker_id = auth.uid());
CREATE POLICY "Admins can manage payment requests" ON payment_requests FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Filmmaker balances policies
CREATE POLICY "Admins can view all balances" ON filmmaker_balances FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Filmmakers can view own balance" ON filmmaker_balances FOR SELECT TO authenticated USING (filmmaker_id = auth.uid());
CREATE POLICY "Admins can manage balances" ON filmmaker_balances FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
