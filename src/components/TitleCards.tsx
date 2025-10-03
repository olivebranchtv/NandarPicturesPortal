import React, { useState, useEffect } from 'react';
import { Film, DollarSign, Calendar, Hash, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ChannelRevenue {
  channel: string;
  revenue: number;
  paymentsCount: number;
}

interface TitleMetrics {
  id: string;
  title_name: string;
  content_type: string;
  totalRevenue: number;
  netIncome: number;
  paymentsCount: number;
  latestPaymentDate: string | null;
  balanceDue: number;
  channelBreakdown: ChannelRevenue[];
}

interface TitleCardsProps {
  filmakerId: string;
}

export function TitleCards({ filmakerId }: TitleCardsProps) {
  const [titles, setTitles] = useState<TitleMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());

  const toggleChannelExpansion = (titleId: string) => {
    setExpandedChannels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(titleId)) {
        newSet.delete(titleId);
      } else {
        newSet.add(titleId);
      }
      return newSet;
    });
  };

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

        // Calculate channel breakdown
        const channelMap = new Map<string, { revenue: number; count: number }>();

        titlePayments.forEach(payment => {
          const channel = payment.channel || 'Unknown';
          const existing = channelMap.get(channel) || { revenue: 0, count: 0 };
          existing.revenue += payment.gross_amount || 0;
          existing.count += 1;
          channelMap.set(channel, existing);
        });

        const channelBreakdown: ChannelRevenue[] = Array.from(channelMap.entries())
          .map(([channel, data]) => ({
            channel,
            revenue: data.revenue,
            paymentsCount: data.count
          }))
          .sort((a, b) => b.revenue - a.revenue);

        // Add historical data if exists
        const historicalRevenue = title.previous_gross_amount || 0;
        const historicalNetIncome = title.previous_net_revenue || 0;
        const historicalPaid = title.previous_amount_paid || 0;

        // Add historical revenue as separate channel if exists
        if (historicalRevenue > 0) {
          channelBreakdown.push({
            channel: 'Historical',
            revenue: historicalRevenue,
            paymentsCount: 0
          });
        }

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
          channelBreakdown: channelBreakdown.sort((a, b) => b.revenue - a.revenue),
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

              {/* Channel Revenue Breakdown */}
              {title.channelBreakdown.length > 0 && (
                <div className="pt-4 border-t">
                  <div className="flex items-center space-x-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <h4 className="text-sm font-semibold text-gray-900">Revenue by Channel</h4>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={title.channelBreakdown}
                        layout="horizontal"
                        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          type="number"
                          tickFormatter={(value) => {
                            if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
                            return `$${value}`;
                          }}
                          domain={[0, 'auto']}
                        />
                        <YAxis
                          type="category"
                          dataKey="channel"
                          width={100}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(value: number) => [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Revenue']}
                          labelFormatter={(label) => `${label}`}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                        />
                        <Bar dataKey="revenue" radius={[0, 4, 4, 0]} minPointSize={5}>
                          {title.channelBreakdown.map((entry, index) => {
                            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 space-y-1">
                    {(expandedChannels.has(title.id) ? title.channelBreakdown : title.channelBreakdown.slice(0, 3)).map((channel, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{channel.channel}</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(channel.revenue)}</span>
                      </div>
                    ))}
                    {title.channelBreakdown.length > 3 && (
                      <button
                        onClick={() => toggleChannelExpansion(title.id)}
                        className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 font-medium mt-2 transition-colors"
                      >
                        {expandedChannels.has(title.id) ? (
                          <>
                            <ChevronUp className="h-3 w-3" />
                            <span>Show less</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" />
                            <span>Show all {title.channelBreakdown.length} channels</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
