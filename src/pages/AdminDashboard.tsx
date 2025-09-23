import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Film, DollarSign, TrendingUp, Plus, Check, X, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { supabase, User, Content, PaymentRequest, StreamingPayment } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface AdminStats {
  totalUsers: number;
  totalTitles: number;
  totalRevenue: number;
  pendingRequests: number;
}

export function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalTitles: 0,
    totalRevenue: 0,
    pendingRequests: 0,
  });
  const [users, setUsers] = useState<User[]>([]);
  const [titles, setTitles] = useState<Content[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [streamingPayments, setStreamingPayments] = useState<StreamingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showCreateFilmmaker, setShowCreateFilmmaker] = useState(false);
  const [newPayment, setNewPayment] = useState({
    title_id: '',
    platform: '',
    outlet: '',
    payment_date: '',
    gross_amount: '',
    distribution_percentage: '50',
    notes: '',
  });
  const [newFilmmaker, setNewFilmmaker] = useState({
    email: '',
    first_name: '',
    last_name: '',
  });

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    try {
      console.log('Fetching admin dashboard data...');
      
      // Fetch all users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('Users query result:', { usersData, usersError });
      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch all titles/content
      const { data: allTitles, error: titlesError } = await supabase
        .from('content')
        .select(`
          *,
          users!content_filmmaker_id_fkey(first_name, last_name, email)
        `)
        .order('created_at', { ascending: false });

      console.log('Titles query result:', { allTitles, titlesError });
      if (titlesError) throw titlesError;
      setTitles(allTitles || []);

      // Fetch all payment requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('payment_requests')
        .select(`
          *,
          users!payment_requests_filmmaker_id_fkey(first_name, last_name, email)
        `)
        .order('requested_at', { ascending: false });

      console.log('Payment requests query result:', { requestsData, requestsError });
      if (requestsError) throw requestsError;
      setPaymentRequests(requestsData || []);

      // Fetch all streaming payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('streaming_payments')
        .select(`
          *,
          content!inner(title_name, filmmaker_id)
        `)
        .order('payment_date', { ascending: false });

      console.log('Streaming payments query result:', { paymentsData, paymentsError });
      if (paymentsError) throw paymentsError;

      // Process historical data from titles
      const historicalPayments = allTitles?.filter(content => 
        content.previous_gross_amount > 0 || content.previous_expenses > 0
      ).map(content => ({
        id: `historical-${content.id}`,
        title_id: content.id,
        platform: 'Historical Data',
        outlet: null,
        payment_date: content.created_at.split('T')[0],
        gross_amount: content.previous_gross_amount || 0,
        net_amount: (content.previous_gross_amount || 0) - (content.previous_expenses || 0),
        distribution_percentage: 50,
        notes: 'Historical revenue data',
        created_at: content.created_at,
        updated_at: content.updated_at,
        content: {
          title_name: content.title_name,
          filmmaker_id: content.filmmaker_id
        }
      })) || [];

      console.log('Historical payments processed:', historicalPayments);

      // Combine streaming payments with historical data
      const allPayments = [...(paymentsData || []), ...historicalPayments];
      setStreamingPayments(allPayments);

      // Calculate total revenue including historical data
      const streamingRevenue = paymentsData?.reduce((sum, payment) => sum + (payment.gross_amount || 0), 0) || 0;
      const historicalRevenue = allTitles?.reduce((sum, content) => sum + (content.previous_gross_amount || 0), 0) || 0;
      const totalRevenue = streamingRevenue + historicalRevenue;

      // Calculate stats
      const totalUsers = usersData?.length || 0;
      const totalTitles = allTitles?.length || 0;
      const pendingRequests = requestsData?.filter(req => req.status === 'pending').length || 0;

      console.log('Summary stats calculated:', {
        totalUsers,
        totalTitles,
        totalRevenue,
        pendingRequests,
        streamingRevenue,
        historicalRevenue
      });

      setStats({
        totalUsers,
        totalTitles,
        totalRevenue,
        pendingRequests,
      });

    } catch (error) {
      console.error('Error fetching admin dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePayment = async (requestId: string, approvedAmount?: number) => {
    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({ 
          status: 'approved',
          amount_approved: approvedAmount,
          admin_notes: 'Approved by admin'
        })
        .eq('id', requestId);

      if (error) throw error;
      fetchDashboardData();
    } catch (error) {
      console.error('Error approving payment:', error);
    }
  };

  const handleRejectPayment = async (requestId: string, reason: string) => {
    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({ 
          status: 'rejected',
          admin_notes: reason
        })
        .eq('id', requestId);

      if (error) throw error;
      fetchDashboardData();
    } catch (error) {
      console.error('Error rejecting payment:', error);
    }
  };

  const handleAddPayment = async () => {
    try {
      const { error } = await supabase
        .from('streaming_payments')
        .insert({
          title_id: newPayment.title_id,
          platform: newPayment.platform,
          outlet: newPayment.outlet || null,
          payment_date: newPayment.payment_date,
          gross_amount: parseFloat(newPayment.gross_amount),
          distribution_percentage: parseFloat(newPayment.distribution_percentage),
          notes: newPayment.notes || null,
        });

      if (error) throw error;

      setNewPayment({
        title_id: '',
        platform: '',
        outlet: '',
        payment_date: '',
        gross_amount: '',
        distribution_percentage: '50',
        notes: '',
      });
      setShowAddPayment(false);
      fetchDashboardData();
    } catch (error) {
      console.error('Error adding payment:', error);
      alert('Error adding payment. Please try again.');
    }
  };

  const handleCreateFilmmaker = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-filmmaker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify(newFilmmaker),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create filmmaker');
      }

      alert(`Filmmaker created successfully! Temporary password: ${result.temporary_password}`);
      setNewFilmmaker({ email: '', first_name: '', last_name: '' });
      setShowCreateFilmmaker(false);
      fetchDashboardData();
    } catch (error) {
      console.error('Error creating filmmaker:', error);
      alert(`Error creating filmmaker: ${error.message}`);
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

  // Create chart data
  const chartData = streamingPayments
    .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
    .slice(0, 10)
    .map(payment => ({
      title: payment.content.title_name.substring(0, 15) + (payment.content.title_name.length > 15 ? '...' : ''),
      amount: payment.gross_amount || 0,
      date: payment.payment_date,
      platform: payment.platform
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <div className="flex space-x-3">
          <Button
            onClick={() => setShowCreateFilmmaker(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Create Filmmaker</span>
          </Button>
          <Button
            onClick={() => setShowAddPayment(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Payment</span>
          </Button>
        </div>
      </div>

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-red-600">Debug Information</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p><strong>Total Users:</strong> {users.length}</p>
                <p><strong>Admins:</strong> {users.filter(u => u.role === 'admin').length}</p>
                <p><strong>Filmmakers:</strong> {users.filter(u => u.role === 'filmmaker').length}</p>
                <p><strong>Partners:</strong> {users.filter(u => u.role === 'partner').length}</p>
              </div>
              <div>
                <p><strong>Total Titles:</strong> {titles.length}</p>
                <p><strong>Pending:</strong> {titles.filter(t => t.status === 'pending').length}</p>
                <p><strong>Approved:</strong> {titles.filter(t => t.status === 'approved').length}</p>
                <p><strong>Rejected:</strong> {titles.filter(t => t.status === 'rejected').length}</p>
              </div>
              <div>
                <p><strong>Streaming Payments:</strong> {streamingPayments.filter(p => !p.id.toString().startsWith('historical')).length}</p>
                <p><strong>Historical Payments:</strong> {streamingPayments.filter(p => p.id.toString().startsWith('historical')).length}</p>
                <p><strong>Payment Requests:</strong> {paymentRequests.length}</p>
                <p><strong>Pending Requests:</strong> {paymentRequests.filter(r => r.status === 'pending').length}</p>
              </div>
              <div>
                <p><strong>Total Revenue:</strong> ${stats.totalRevenue.toLocaleString()}</p>
                <p><strong>Current User Role:</strong> {profile?.role}</p>
                <p><strong>Current User ID:</strong> {profile?.id?.substring(0, 8)}...</p>
              </div>
            </div>
            {titles.length > 0 && (
              <div className="mt-4">
                <p><strong>Sample Titles:</strong></p>
                {titles.slice(0, 3).map(title => (
                  <p key={title.id} className="text-xs">
                    - {title.title_name} (Filmmaker: {title.users?.first_name} {title.users?.last_name})
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Users}
          title="Total Users"
          value={stats.totalUsers}
          color="bg-blue-600"
        />
        <StatCard
          icon={Film}
          title="Total Titles"
          value={stats.totalTitles}
          color="bg-green-600"
        />
        <StatCard
          icon={DollarSign}
          title="Total Revenue"
          value={`$${stats.totalRevenue.toLocaleString()}`}
          color="bg-purple-600"
        />
        <StatCard
          icon={TrendingUp}
          title="Pending Requests"
          value={stats.pendingRequests}
          color="bg-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Recent Payments
            </h3>
          </CardHeader>
          <CardContent>
            {streamingPayments.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="title" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                    labelFormatter={(label) => `Title: ${label}`}
                  />
                  <Bar dataKey="amount" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No payment data available</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Payment Requests */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Pending Payment Requests</h3>
          </CardHeader>
          <CardContent>
            {paymentRequests.filter(req => req.status === 'pending').length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {paymentRequests
                  .filter(req => req.status === 'pending')
                  .map((request) => (
                    <div key={request.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">
                            {request.filmmaker?.first_name} {request.filmmaker?.last_name}
                          </p>
                          <p className="text-sm text-gray-500">{request.filmmaker?.email}</p>
                        </div>
                        <p className="font-bold text-lg text-gray-900">
                          ${request.amount_requested.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprovePayment(request.id, request.amount_requested)}
                          className="flex items-center space-x-1"
                        >
                          <Check className="h-3 w-3" />
                          <span>Approve</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleRejectPayment(request.id, 'Rejected by admin')}
                          className="flex items-center space-x-1"
                        >
                          <X className="h-3 w-3" />
                          <span>Reject</span>
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No pending payment requests</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Titles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">All Titles</h3>
            <div className="text-sm text-gray-500">
              {titles.length} title{titles.length !== 1 ? 's' : ''}
            </div>
          </div>
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
                      Filmmaker
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
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
                        {title.users?.first_name} {title.users?.last_name}
                        <br />
                        <span className="text-xs text-gray-400">{title.users?.email}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          title.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          title.status === 'approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {title.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${((title.revenue_total || 0) + (title.previous_gross_amount || 0)).toLocaleString()}
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">No titles found</h3>
              <p className="text-gray-500">Titles will appear here when filmmakers upload content</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Users */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">All Users</h3>
            <div className="text-sm text-gray-500">
              {users.length} user{users.length !== 1 ? 's' : ''}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.first_name} {user.last_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'admin' ? 'bg-red-100 text-red-800' :
                          user.role === 'filmmaker' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
              <p className="text-gray-500">Users will appear here when they sign up</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Modal */}
      {showAddPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Add Streaming Payment</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <select
                    value={newPayment.title_id}
                    onChange={(e) => setNewPayment({ ...newPayment, title_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a title</option>
                    {titles.map((title) => (
                      <option key={title.id} value={title.id}>
                        {title.title_name}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Platform"
                  value={newPayment.platform}
                  onChange={(e) => setNewPayment({ ...newPayment, platform: e.target.value })}
                  placeholder="e.g., Netflix, Amazon Prime"
                />
                <Input
                  label="Outlet (Optional)"
                  value={newPayment.outlet}
                  onChange={(e) => setNewPayment({ ...newPayment, outlet: e.target.value })}
                  placeholder="e.g., US, UK, Global"
                />
                <Input
                  label="Payment Date"
                  type="date"
                  value={newPayment.payment_date}
                  onChange={(e) => setNewPayment({ ...newPayment, payment_date: e.target.value })}
                />
                <Input
                  label="Gross Amount"
                  type="number"
                  step="0.01"
                  value={newPayment.gross_amount}
                  onChange={(e) => setNewPayment({ ...newPayment, gross_amount: e.target.value })}
                  placeholder="0.00"
                />
                <Input
                  label="Distribution Percentage"
                  type="number"
                  value={newPayment.distribution_percentage}
                  onChange={(e) => setNewPayment({ ...newPayment, distribution_percentage: e.target.value })}
                  placeholder="50"
                />
                <Input
                  label="Notes (Optional)"
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                  placeholder="Additional notes"
                />
              </div>
              <div className="flex space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setShowAddPayment(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddPayment}
                  className="flex-1"
                  disabled={!newPayment.title_id || !newPayment.platform || !newPayment.payment_date || !newPayment.gross_amount}
                >
                  Add Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Filmmaker Modal */}
      {showCreateFilmmaker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Create New Filmmaker</h3>
              <div className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  value={newFilmmaker.email}
                  onChange={(e) => setNewFilmmaker({ ...newFilmmaker, email: e.target.value })}
                  placeholder="filmmaker@example.com"
                />
                <Input
                  label="First Name"
                  value={newFilmmaker.first_name}
                  onChange={(e) => setNewFilmmaker({ ...newFilmmaker, first_name: e.target.value })}
                  placeholder="John"
                />
                <Input
                  label="Last Name"
                  value={newFilmmaker.last_name}
                  onChange={(e) => setNewFilmmaker({ ...newFilmmaker, last_name: e.target.value })}
                  placeholder="Doe"
                />
              </div>
              <div className="flex space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setShowCreateFilmmaker(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateFilmmaker}
                  className="flex-1"
                  disabled={!newFilmmaker.email || !newFilmmaker.first_name || !newFilmmaker.last_name}
                >
                  Create Filmmaker
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}