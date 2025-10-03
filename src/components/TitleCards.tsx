import React, { useState, useEffect } from 'react';
import { Film, DollarSign, Calendar, Hash } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { supabase } from '../lib/supabase';

interface TitleMetrics {
  id: string;
  title_name: string;
  content_type: string;
  totalRevenue: number;
  netIncome: number;
  paymentsCount: number;
  latestPaymentDate: string | null;
  balanceDue: number;
}

interface TitleCardsProps {
  filmakerId: string;
}

export function TitleCards({ filmakerId }: TitleCardsProps) {
  const [titles, setTitles] = useState<TitleMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTitleMetrics();
  }, [filmakerId]);

  const fetchTitleMetrics = async () => {
    try {
      setLoading(true);

      // Fetch all titles for the filmmaker
      const { data: titlesData, error: titlesError } = await supabase
        .from('content')
        .select('*')
        .eq('filmmaker_id', filmakerId);

      if (titlesError) throw titlesError;

      // Fetch all payments for this filmmaker
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('filmmaker_id', filmakerId);

      if (paymentsError) throw paymentsError;

      // Process each title
      const titleMetrics: TitleMetrics[] = (titlesData || []).map(title => {
        // Filter payments for this specific title
        const titlePayments = (paymentsData || []).filter(p => p.content_id === title.id);

        // Calculate metrics from payments
        const totalRevenue = titlePayments.reduce((sum, p) => sum + (p.gross_amount || 0), 0);
        const netIncome = titlePayments.reduce((sum, p) => sum + (p.net_amount || 0), 0);
        const paymentsCount = titlePayments.length;

        // Find latest payment date
        const latestPaymentDate = titlePayments.length > 0
          ? titlePayments.reduce((latest, p) => {
              return !latest || p.payment_date > latest ? p.payment_date : latest;
            }, '')
          : null;

        // Add historical data if exists
        const historicalRevenue = title.previous_gross_amount || 0;
        const historicalNetIncome = title.previous_net_revenue || 0;
        const historicalPaid = title.previous_amount_paid || 0;

        const totalRevenueCombined = totalRevenue + historicalRevenue;
        const netIncomeCombined = netIncome + historicalNetIncome;
        const balanceDue = Math.max(0, netIncomeCombined - historicalPaid);

        return {
          id: title.id,
          title_name: title.title_name,
          content_type: title.content_type,
          totalRevenue: totalRevenueCombined,
          netIncome: netIncomeCombined,
          paymentsCount,
          latestPaymentDate,
          balanceDue,
        };
      });

      setTitles(titleMetrics);
    } catch (error) {
      console.error('Error fetching title metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (date: string | null) => {
    if (!date) return 'No payments yet';
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading titles...</div>
      </div>
    );
  }

  if (titles.length === 0) {
    return (
      <div className="text-center py-12">
        <Film className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No titles yet</h3>
        <p className="text-gray-500">Your titles will appear here once they are added to the system</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {titles.map((title) => (
        <Card key={title.id} className="overflow-hidden hover:shadow-lg transition-shadow">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold truncate">{title.title_name}</h3>
                <p className="text-sm text-blue-100 capitalize">{title.content_type}</p>
              </div>
              <Film className="h-6 w-6 flex-shrink-0 ml-2" />
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Total Revenue */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Revenue</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(title.totalRevenue)}</p>
                  </div>
                </div>
              </div>

              {/* Net Income */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Net Income</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(title.netIncome)}</p>
                  </div>
                </div>
              </div>

              {/* Balance Due */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <DollarSign className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Balance Due</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(title.balanceDue)}</p>
                  </div>
                </div>
              </div>

              {/* Payments Count */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <Hash className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{title.paymentsCount} payment{title.paymentsCount !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Latest Payment Date */}
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Latest Payment</p>
                  <p className="text-sm text-gray-700">{formatDate(title.latestPaymentDate)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
