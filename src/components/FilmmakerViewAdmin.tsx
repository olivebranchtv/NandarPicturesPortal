import React, { useState, useEffect } from 'react';
import { X, DollarSign, Film, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { supabase, User, Content, Payment } from '../lib/supabase';

interface FilmmakerViewAdminProps {
  filmmaker: User;
  onClose: () => void;
}

export function FilmmakerViewAdmin({ filmmaker, onClose }: FilmmakerViewAdminProps) {
  const [titles, setTitles] = useState<Content[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTitles: 0,
    totalEarnings: 0,
    totalPaid: 0,
    availableBalance: 0,
  });

  useEffect(() => {
    fetchFilmmakerData();
  }, [filmmaker.id]);

  const fetchFilmmakerData = async () => {
    try {
      const titlesRes = await supabase!
        .from('content')
        .select('*')
        .or(`filmmaker_id.eq.${filmmaker.id},owner_id.eq.${filmmaker.id},owner_email.eq.${filmmaker.email}`)
        .order('created_at', { ascending: false });

      if (titlesRes.error) throw titlesRes.error;
      setTitles(titlesRes.data || []);

      const titleIds = (titlesRes.data || []).map(t => t.id);

      let allPayments: any[] = [];

      if (titleIds.length > 0) {
        // Fetch payments in batches
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase!
            .from('payments')
            .select('*, content:content_id(title_name)')
            .in('content_id', titleIds)
            .order('payment_date', { ascending: false })
            .range(from, from + batchSize - 1);

          if (data && data.length > 0 && !error) {
            allPayments = [...allPayments, ...data];
            from += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }

        const streamingRes = await supabase!
          .from('streaming_payments')
          .select('*, content!streaming_payments_title_id_fkey(title_name)')
          .in('title_id', titleIds)
          .order('payment_date', { ascending: false });

        if (streamingRes.data && !streamingRes.error) {
          allPayments = [...allPayments, ...streamingRes.data];
        }
      }

      const historicalPayments = (titlesRes.data || [])
        .filter(content =>
          (content.previous_gross_amount && content.previous_gross_amount > 0) ||
          (content.previous_net_revenue && content.previous_net_revenue > 0)
        )
        .map(content => ({
          id: `historical-${content.id}`,
          content_id: content.id,
          title_name: content.title_name,
          payment_date: content.created_at.split('T')[0],
          gross_amount: content.previous_gross_amount || 0,
          net_amount: content.previous_net_revenue || 0,
          channel: 'Historical Data',
          content: { title_name: content.title_name }
        }));

      allPayments = [...allPayments, ...historicalPayments];
      allPayments.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

      setPayments(allPayments);

      const totalEarnings = allPayments.reduce(
        (sum, p) => sum + (p.gross_amount || 0),
        0
      );
      const netEarnings = allPayments.reduce(
        (sum, p) => sum + (p.net_amount || 0),
        0
      );

      // Total paid = sum of all payment_requests marked as paid for this filmmaker
      const paidRequestsRes = await supabase!
        .from('payment_requests')
        .select('amount_approved, amount_requested')
        .eq('filmmaker_id', filmmaker.id)
        .eq('status', 'paid');

      const totalPaid = (paidRequestsRes.data ?? []).reduce(
        (sum, r) => sum + (r.amount_approved ?? r.amount_requested ?? 0), 0
      );

      setStats({
        totalTitles: titlesRes.data?.length || 0,
        totalEarnings,
        totalPaid,
        availableBalance: Math.max(0, netEarnings - totalPaid),
      });
    } catch (error) {
      console.error('Error fetching filmmaker data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl my-8">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {filmmaker.first_name} {filmmaker.last_name}'s Dashboard
              </h2>
              <p className="text-sm text-gray-500">{filmmaker.email}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 rounded-lg bg-blue-600">
                    <Film className="h-5 w-5 text-white" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-500">Titles</p>
                    <p className="text-xl font-bold text-gray-900">
                      {stats.totalTitles}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 rounded-lg bg-green-600">
                    <DollarSign className="h-5 w-5 text-white" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-500">
                      Total Earnings
                    </p>
                    <p className="text-xl font-bold text-gray-900">
                      ${stats.totalEarnings.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 rounded-lg bg-purple-600">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-500">Total Paid</p>
                    <p className="text-xl font-bold text-gray-900">
                      ${stats.totalPaid.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 rounded-lg bg-orange-600">
                    <DollarSign className="h-5 w-5 text-white" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-500">Available</p>
                    <p className="text-xl font-bold text-gray-900">
                      ${stats.availableBalance.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Titles</h3>
              </CardHeader>
              <CardContent>
                {titles.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {titles.map((title) => (
                      <div
                        key={title.id}
                        className="p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="font-medium text-gray-900">
                          {title.title_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {title.content_type} • {title.status}
                        </div>
                        <div className="text-sm text-gray-700 mt-1">
                          Revenue: ${title.revenue_total.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No titles found
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Payment History</h3>
              </CardHeader>
              <CardContent>
                {payments.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-900">
                              {payment.content?.title_name || payment.title_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(payment.payment_date).toLocaleDateString()}
                              {payment.channel && ` • ${payment.channel}`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-700">
                              ${payment.gross_amount.toLocaleString()}
                            </div>
                            <div className="text-xs text-green-600">
                              Net: ${payment.net_amount.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No payments found
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">
              Filmmaker Information
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700">PayPal:</span>{' '}
                <span className="text-blue-900">
                  {filmmaker.paypal_email || 'Not set'}
                </span>
              </div>
              <div>
                <span className="text-blue-700">Venmo:</span>{' '}
                <span className="text-blue-900">
                  {filmmaker.venmo_username || 'Not set'}
                </span>
              </div>
              <div>
                <span className="text-blue-700">Address:</span>{' '}
                <span className="text-blue-900">
                  {filmmaker.address
                    ? `${filmmaker.address}, ${filmmaker.city}, ${filmmaker.state} ${filmmaker.zip_code}`
                    : 'Not set'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
