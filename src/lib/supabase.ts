import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not configured. Please connect to Supabase.');
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Types
export interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'admin' | 'filmmaker';
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  paypal_email?: string;
  venmo_username?: string;
  created_at: string;
  updated_at: string;
}

export interface Title {
  id: string;
  title_name: string;
  filmmaker_id: string;
  revenue_total: number;
  distribution_fee: number;
  expenses_total: number;
  net_revenue: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentRequest {
  id: string;
  filmmaker_id: string;
  title_id: string;
  amount_requested: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  admin_notes?: string;
  amount_approved?: number;
  payment_method_used?: string;
  date_paid?: string;
  requested_at: string;
  updated_at: string;
}