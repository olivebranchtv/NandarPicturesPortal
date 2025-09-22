import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, Film, DollarSign, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { supabase, Title, PaymentRequest, User } from '../lib/supabase';

interface DashboardStats {
  totalTitles: number;
  totalFilmmakers: number;
  totalRevenue: number;
  pendingPayments: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalTitles: 0,
    totalFilmmakers: 0,
    totalRevenue: 0,
    pendingPayments: 0,
  });
  const [recentTitles, setRecentTitles] = useState<Title[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PaymentRequest[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats
      const [titlesResult, usersResult, paymentsResult] = await Promise.all([
        supabase.from('titles').select('revenue_total'),
        supabase.from('users').select('id').eq('role', 'filmmaker'),
        supabase.from('payment_requests').select('*').eq('status', 'pending'),
      ]);

      if (titlesResult.error) throw titlesResult.error;
      if (usersResult.error) throw usersResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      const totalRevenue = titlesResult.data?.reduce((sum, title) => sum + (title.revenue_total || 0), 0) || 0;

      setStats({
        totalTitles: titlesResult.data?.length || 0,
        totalFilmmakers: usersResult.data?.length || 0,
        totalRevenue,
        pendingPayments: paymentsResult.data?.length || 0,
      });

      setPendingRequests(paymentsResult.data || []);

      // Fetch recent titles with filmmaker info
      const { data: titles, error: titlesError } = await supabase
        .from('titles')
        .select(`
          *,
          users!titles_filmmaker_id_fkey (first_name, last_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (titlesError) throw titlesError;
      setRecentTitles(titles || []);

      // Create sample revenue data for chart
      const chartData = titles?.slice(0, 5).map(title => ({
        title: title.title_name.substring(0, 15) + (title.title_name.length > 15 ? '...' : ''),
        revenue: title.revenue_total || 0,
        expenses: title.expenses_total || 0,
        net: title.net_revenue || 0,
      })) || [];

      setRevenueData(chartData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <div className="text-sm text-gray-500">
          Welcome back! Here's your distribution overview.
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Film}
          title="Total Titles"
          value={stats.totalTitles}
          color="bg-blue-600"
        />
        <StatCard
          icon={Users}
          title="Filmmakers"
          value={stats.totalFilmmakers}
          color="bg-green-600"
        />
        <StatCard
          icon={DollarSign}
          title="Total Revenue"
          value={`$${stats.totalRevenue.toLocaleString()}`}
          color="bg-purple-600"
        />
        <StatCard
          icon={Clock}
          title="Pending Payments"
          value={stats.pendingPayments}
          color="bg-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Top Titles by Revenue
            </h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="title" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, '']} />
                <Bar dataKey="revenue" fill="#3B82F6" name="Revenue" />
                <Bar dataKey="net" fill="#10B981" name="Net Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pending Payment Requests */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              Pending Payment Requests
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingRequests.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No pending requests</p>
              ) : (
                pendingRequests.slice(0, 5).map((request) => (
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
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Titles */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Recent Titles</h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Filmmaker
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
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
                {recentTitles.map((title: any) => (
                  <tr key={title.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {title.title_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {title.users?.first_name && title.users?.last_name 
                        ? `${title.users.first_name} ${title.users.last_name}`
                        : title.users?.email
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${title.revenue_total?.toLocaleString() || '0'}
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
        </CardContent>
      </Card>
    </div>
  );
}