import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Film, DollarSign, Clock, Plus, Check, X, Edit } from 'lucide-react';
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

interface CreateFilmmakerData {
  email: string;
  first_name: string;
  last_name: string;
}

export function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalTitles: 0,
    totalRevenue: 0,
    pendingRequests: 0,
  });
  const [filmmakers, setFilmmakers] = useState<User[]>([]);
  const [titles, setTitles] = useState<Content[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [streamingPayments, setStreamingPayments] = useState<StreamingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddFilmmaker, setShowAddFilmmaker] = useState(false);
  const [showAddTitle, setShowAddTitle] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [newFilmmaker, setNewFilmmaker] = useState<CreateFilmmakerData>({
    email: '',
    first_name: '',
    last_name: '',
  });
  const [newTitle, setNewTitle] = useState({
    title_name: '',
    content_type: 'movie' as 'movie' | 'series' | 'episode',
    description: '',
    genre: '',
    release_date: '',
    duration_minutes: '',
    rating: '',
    filmmaker_id: '',
  });
  const [newPayment, setNewPayment] = useState({
    title_id: '',
    platform: '',
    outlet: '',
    payment_date: '',
    gross_amount: '',
    distribution_percentage: '50',
    notes: '',
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

      // Filter filmmakers
      const filmmakersData = usersData?.filter(user => user.role === 'filmmaker') || [];
      setFilmmakers(filmmakersData);
      console.log('Filmmakers found:', filmmakersData.length);

      // Fetch all content/titles
      const { data: titlesData, error: titlesError } = await supabase
        .from('content')
        .select(`
          *,
          filmmaker:users!content_filmmaker_id_fkey(first_name, last_name, email)
        `)
        .order('created_at', { ascending: false });

      console.log('Titles query result:', { titlesData, titlesError });
      if (titlesError) throw titlesError;
      setTitles(titlesData || []);

      // Fetch payment requests with filmmaker info
      const { data: requestsData, error: requestsError } = await supabase
        .from('payment_requests')
        .select(`
          *,
          filmmaker:users!payment_requests_filmmaker_id_fkey(first_name, last_name, email)
        `)
        .order('requested_at', { ascending: false });

      console.log('Payment requests query result:', { requestsData, requestsError });
      if (requestsError) throw requestsError;
      setPaymentRequests(requestsData || []);

      // Fetch streaming payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('streaming_payments')
        .select(`
          *,
          content!inner(title_name, filmmaker_id)
        `)
        .order('payment_date', { ascending: false });

      console.log('Streaming payments query result:', { paymentsData, paymentsError });
      if (paymentsError) throw paymentsError;
      setStreamingPayments(paymentsData || []);

      // Calculate stats
      const totalRevenue = (paymentsData || []).reduce((sum, payment) => sum + (payment.gross_amount || 0), 0);
      const pendingRequests = (requestsData || []).filter(req => req.status === 'pending').length;

      const calculatedStats = {
        totalUsers: filmmakersData.length,
        totalTitles: titlesData?.length || 0,
        totalRevenue,
        pendingRequests,
      };

      console.log('Calculated stats:', calculatedStats);
      setStats(calculatedStats);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFilmmaker = async () => {
    if (!newFilmmaker.email || !newFilmmaker.first_name || !newFilmmaker.last_name) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      console.log('Creating filmmaker:', newFilmmaker);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-filmmaker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(newFilmmaker),
      });

      const result = await response.json();
      console.log('Create filmmaker result:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create filmmaker');
      }

      alert(`Filmmaker created successfully! Temporary password: ${result.temporary_password}`);
      setNewFilmmaker({ email: '', first_name: '', last_name: '' });
      setShowAddFilmmaker(false);
      fetchDashboardData();
    } catch (error) {
      console.error('Error creating filmmaker:', error);
      alert(`Error creating filmmaker: ${error.message}`);
    }
  };

  const handleCreateTitle = async () => {
    if (!newTitle.title_name || !newTitle.filmmaker_id) {
      alert('Please fill in title name and select a filmmaker');
      return;
    }

    try {
      const { error } = await supabase
        .from('content')
        .insert({
          title_name: newTitle.title_name,
          content_type: newTitle.content_type,
          description: newTitle.description || null,
          genre: newTitle.genre || null,
          release_date: newTitle.release_date || null,
          duration_minutes: newTitle.duration_minutes ? parseInt(newTitle.duration_minutes) : null,
          rating: newTitle.rating || null,
          filmmaker_id: newTitle.filmmaker_id,
          status: 'approved', // Admin-created titles are auto-approved
        });

      if (error) throw error;

      alert('Title created successfully!');
      setNewTitle({
        title_name: '',
        content_type: 'movie',
        description: '',
        genre: '',
        release_date: '',
        duration_minutes: '',
        rating: '',
        filmmaker_id: '',
      });
      setShowAddTitle(false);
      fetchDashboardData();
    } catch (error) {
      console.error('Error creating title:', error);
      alert('Error creating title. Please try again.');
    }
  };

  const handleAddPayment = async () => {
    if (!newPayment.title_id || !newPayment.platform || !newPayment.payment_date || !newPayment.gross_amount) {
      alert('Please fill in all required fields');
      return;
    }

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

      alert('Payment added successfully!');
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

  const handleApprovePayment = async (requestId: string, approvedAmount: number) => {
    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({
          status: 'approved',
          amount_approved: approvedAmount
        })
        .eq('id', requestId);

      if (error) throw error;

      alert('Payment request approved!');
      fetchDashboardData();
    } catch (error) {
      console.error('Error approving payment:', error);
      alert('Error approving payment request. Please try again.');
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
    .slice(0, 6)
    .map(payment => ({
      title: payment.content.title_name.substring(0, 15) + (payment.content.title_name.length > 15 ? '...' : ''),
      revenue: payment.gross_amount || 0,
      expenses: (payment.gross_amount || 0) * 0.3, // Estimated expenses
      net: payment.net_amount || 0,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <div className="flex space-x-3">
          <Button onClick={() => setShowAddTitle(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Title
          </Button>
          <Button onClick={() => setShowAddFilmmaker(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Filmmaker
          </Button>
          <Button onClick={() => setShowAddPayment(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Payment
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Users}
          title="Total Filmmakers"
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
          icon={Clock}
          title="Pending Approvals"
          value={stats.pendingRequests}
          color="bg-orange-600"
        />
      </div>

      {/* Debug Information */}
      {process.env.NODE_ENV === 'development' && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-red-600">Debug Information</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p><strong>Filmmakers:</strong> {filmmakers.length}</p>
                <p><strong>Titles:</strong> {titles.length}</p>
                <p><strong>Payment Requests:</strong> {paymentRequests.length}</p>
                <p><strong>Streaming Payments:</strong> {streamingPayments.length}</p>
              </div>
              <div>
                <p><strong>Sample Filmmaker:</strong> {filmmakers[0]?.email || 'None'}</p>
                <p><strong>Sample Title:</strong> {titles[0]?.title_name || 'None'}</p>
                <p><strong>Admin Role:</strong> {profile?.role}</p>
                <p><strong>Admin ID:</strong> {profile?.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Performance Chart */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Financial Performance</h3>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="title" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                  <Bar dataKey="revenue" fill="#10B981" name="Total Revenue" />
                  <Bar dataKey="expenses" fill="#EF4444" name="Total Expenses" />
                  <Bar dataKey="net" fill="#3B82F6" name="Net Income" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No financial data available</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Recent Activity</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {paymentRequests.slice(0, 5).map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      Payment Request: ${request.amount_requested.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      {request.filmmaker?.first_name} {request.filmmaker?.last_name} • {new Date(request.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      request.status === 'approved' ? 'bg-green-100 text-green-800' :
                      request.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {request.status}
                    </span>
                    {request.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => handleApprovePayment(request.id, request.amount_requested)}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {paymentRequests.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filmmakers Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">All Filmmakers</h3>
            <div className="text-sm text-gray-500">
              {filmmakers.length} filmmaker{filmmakers.length !== 1 ? 's' : ''}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filmmakers.length > 0 ? (
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
                      Titles
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filmmakers.map((filmmaker) => {
                    const filmmakertitles = titles.filter(title => title.filmmaker_id === filmmaker.id);
                    return (
                      <tr key={filmmaker.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {filmmaker.first_name} {filmmaker.last_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {filmmaker.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {filmmakertitles.length}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(filmmaker.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No filmmakers yet</h3>
              <p className="text-gray-500">
                Add your first filmmaker to get started
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Titles Table */}
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
                      Type
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
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {titles.map((title) => (
                    <tr key={title.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {title.title_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {title.content_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {title.filmmaker?.first_name} {title.filmmaker?.last_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          title.status === 'approved' ? 'bg-green-100 text-green-800' :
                          title.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {title.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${title.revenue_total.toLocaleString()}
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
                Add your first title to get started
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Filmmaker Modal */}
      {showAddFilmmaker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Add New Filmmaker</h3>
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
              <div className="flex justify-end space-x-3 mt-6">
                <Button variant="secondary" onClick={() => setShowAddFilmmaker(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateFilmmaker}>
                  Create Filmmaker
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Title Modal */}
      {showAddTitle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Add New Title</h3>
              <div className="space-y-4">
                <Input
                  label="Title Name"
                  value={newTitle.title_name}
                  onChange={(e) => setNewTitle({ ...newTitle, title_name: e.target.value })}
                  placeholder="Enter title name"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                  <select
                    value={newTitle.content_type}
                    onChange={(e) => setNewTitle({ ...newTitle, content_type: e.target.value as 'movie' | 'series' | 'episode' })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="movie">Movie</option>
                    <option value="series">Series</option>
                    <option value="episode">Episode</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filmmaker</label>
                  <select
                    value={newTitle.filmmaker_id}
                    onChange={(e) => setNewTitle({ ...newTitle, filmmaker_id: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a filmmaker</option>
                    {filmmakers.map((filmmaker) => (
                      <option key={filmmaker.id} value={filmmaker.id}>
                        {filmmaker.first_name} {filmmaker.last_name} ({filmmaker.email})
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Description"
                  value={newTitle.description}
                  onChange={(e) => setNewTitle({ ...newTitle, description: e.target.value })}
                  placeholder="Enter description (optional)"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Genre"
                    value={newTitle.genre}
                    onChange={(e) => setNewTitle({ ...newTitle, genre: e.target.value })}
                    placeholder="e.g., Drama, Comedy"
                  />
                  <Input
                    label="Rating"
                    value={newTitle.rating}
                    onChange={(e) => setNewTitle({ ...newTitle, rating: e.target.value })}
                    placeholder="e.g., PG-13, R"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Release Date"
                    type="date"
                    value={newTitle.release_date}
                    onChange={(e) => setNewTitle({ ...newTitle, release_date: e.target.value })}
                  />
                  <Input
                    label="Duration (minutes)"
                    type="number"
                    value={newTitle.duration_minutes}
                    onChange={(e) => setNewTitle({ ...newTitle, duration_minutes: e.target.value })}
                    placeholder="120"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <Button variant="secondary" onClick={() => setShowAddTitle(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTitle}>
                  Create Title
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Add Streaming Payment</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <select
                    value={newPayment.title_id}
                    onChange={(e) => setNewPayment({ ...newPayment, title_id: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                  label="Outlet (optional)"
                  value={newPayment.outlet}
                  onChange={(e) => setNewPayment({ ...newPayment, outlet: e.target.value })}
                  placeholder="e.g., US, International"
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
                  placeholder="1000.00"
                />
                <Input
                  label="Distribution Percentage"
                  type="number"
                  value={newPayment.distribution_percentage}
                  onChange={(e) => setNewPayment({ ...newPayment, distribution_percentage: e.target.value })}
                  placeholder="50"
                />
                <Input
                  label="Notes (optional)"
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                  placeholder="Additional notes"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <Button variant="secondary" onClick={() => setShowAddPayment(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddPayment}>
                  Add Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}