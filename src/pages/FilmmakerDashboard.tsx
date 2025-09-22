import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Film, DollarSign, Clock, TrendingUp, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, Title, PaymentRequest } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface FilmmakerStats {
  totalTitles: number;
  totalRevenue: number;
  totalExpenses: number;
  netRevenue: number;
  availableBalance: number;
}

export function FilmmakerDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<FilmmakerStats>({
    totalTitles: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    netRevenue: 0,
    availableBalance: 0,
  });
  const [titles, setTitles] = useState<Title[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    if (!profile?.id) return;

    try {
      // Fetch filmmaker's titles
      const { data: titlesData, error: titlesError } = await supabase
        .from('titles')
        .select('*')
        .eq('filmmaker_id', profile.id);

      if (titlesError) throw titlesError;

      setTitles(titlesData || []);

      // Calculate stats
      const totalRevenue = titlesData?.reduce((sum, title) => sum + (title.revenue_total || 0), 0) || 0;
      const totalExpenses = titlesData?.reduce((sum, title) => sum + (title.expenses_total || 0) + (title.distribution_fee || 0), 0) || 0;
      const netRevenue = totalRevenue - totalExpenses;

      // Fetch payment requests to calculate available balance
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('filmmaker_id', profile.id);

      if (paymentsError) throw paymentsError;

      setPaymentRequests(paymentsData || []);

      // Calculate available balance (net revenue minus paid/approved payments)
      const paidAmount = paymentsData
        ?.filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + (p.amount_approved || p.amount_requested), 0) || 0;
      
      const availableBalance = Math.max(0, netRevenue - paidAmount);

      setStats({
        totalTitles: titlesData?.length || 0,
        totalRevenue,
        totalExpenses,
        netRevenue,
        availableBalance,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayment = async () => {
    if (!profile?.id || stats.availableBalance < 100) return;

    try {
      const { error } = await supabase
        .from('payment_requests')
        .insert({
          filmmaker_id: profile.id,
          title_id: titles[0]?.id, // For now, use first title - in real app, let user select
          amount_requested: stats.availableBalance,
        });

      if (error) throw error;

      // Refresh data
      fetchDashboardData();
      alert('Payment request submitted successfully!');
    } catch (error) {
      console.error('Error requesting payment:', error);
      alert('Error submitting payment request. Please try again.');
    }
  };

  const StatCard = ({ icon: Icon, title, value, color }: any) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const chartData = titles.map(title => ({
    title: title.title_name.substring(0, 15) + (title.title_name.length > 15 ? '...' : ''),
    revenue: title.revenue_total || 0,
    expenses: title.expenses_total + title.distribution_fee || 0,
    net: title.net_revenue || 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Filmmaker Dashboard</h1>
        <div className="text-sm text-gray-500">
          Welcome back, {profile?.first_name || 'Filmmaker'}!
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Film}
          title="My Titles"
          value={stats.totalTitles}
          color="bg-blue-600"
        />
        <StatCard
          icon={DollarSign}
          title="Total Revenue"
          value={`$${stats.totalRevenue.toLocaleString()}`}
          color="bg-green-600"
        />
        <StatCard
          icon={TrendingUp}
          title="Net Revenue"
          value={`$${stats.netRevenue.toLocaleString()}`}
          color="bg-purple-600"
        />
        <StatCard
          icon={Clock}
          title="Available Balance"
          value={`$${stats.availableBalance.toLocaleString()}`}
          color="bg-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Title Performance
            </h3>
          </CardHeader>
          <CardContent>
            {titles.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="title" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, '']} />
                  <Bar dataKey="revenue" fill="#3B82F6" name="Revenue" />
                  <Bar dataKey="net" fill="#10B981" name="Net Revenue" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <Film className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No titles assigned yet</p>
                  <p className="text-sm">Contact admin to get your titles added</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Request Section */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Request Payment</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Available Balance</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${stats.availableBalance.toLocaleString()}
                </p>
              </div>

              {stats.availableBalance >= 100 ? (
                <Button
                  onClick={handleRequestPayment}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Request Payment
                </Button>
              ) : (
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Minimum balance of $100 required for payment requests
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Titles Table */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">My Titles</h3>
        </CardHeader>
        <CardContent>
          {titles.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expenses
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Net Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Added
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {titles.map((title) => (
                    <tr key={title.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {title.title_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${title.revenue_total?.toLocaleString() || '0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${((title.expenses_total || 0) + (title.distribution_fee || 0)).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${title.net_revenue?.toLocaleString() || '0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(title.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Film className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No titles yet</h3>
              <p className="text-gray-500">
                Your titles will appear here once they're added by admin
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Payment Requests */}
      {paymentRequests.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Recent Payment Requests</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {paymentRequests.slice(0, 5).map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      ${request.amount_requested.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(request.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      request.status === 'approved' ? 'bg-green-100 text-green-800' :
                      request.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {request.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}