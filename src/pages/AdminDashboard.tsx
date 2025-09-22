import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, DollarSign, Film, TrendingUp, Plus, Check, X, Edit2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { supabase, Content, User, PaymentRequest, StreamingPayment } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface AdminStats {
  totalFilmmakers: number;
  totalTitles: number;
  totalRevenue: number;
  pendingApprovals: number;
}

interface NewTitleForm {
  title_name: string;
  content_type: 'movie' | 'series' | 'episode';
  filmmaker_id: string;
  description: string;
  genre: string;
  release_date: string;
  duration_minutes: string;
  rating: string;
}

interface NewFilmmakerForm {
  email: string;
  first_name: string;
  last_name: string;
}

interface NewPaymentForm {
  title_id: string;
  platform: string;
  outlet: string;
  payment_date: string;
  gross_amount: string;
  distribution_percentage: string;
  notes: string;
}

export function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    totalFilmmakers: 0,
    totalTitles: 0,
    totalRevenue: 0,
    pendingApprovals: 0,
  });
  
  const [titles, setTitles] = useState<Content[]>([]);
  const [filmmakers, setFilmmakers] = useState<User[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [streamingPayments, setStreamingPayments] = useState<StreamingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [showAddTitle, setShowAddTitle] = useState(false);
  const [showAddFilmmaker, setShowAddFilmmaker] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  
  const [newTitle, setNewTitle] = useState<NewTitleForm>({
    title_name: '',
    content_type: 'movie',
    filmmaker_id: '',
    description: '',
    genre: '',
    release_date: '',
    duration_minutes: '',
    rating: '',
  });
  
  const [newFilmmaker, setNewFilmmaker] = useState<NewFilmmakerForm>({
    email: '',
    first_name: '',
    last_name: '',
  });
  
  const [newPayment, setNewPayment] = useState<NewPaymentForm>({
    title_id: '',
    platform: '',
    outlet: '',
    payment_date: '',
    gross_amount: '',
    distribution_percentage: '50',
    notes: '',
  });

  useEffect(() => {
    fetchDashboardData();
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      await Promise.all([
        fetchTitles(),
        fetchFilmmakers(),
        fetchPaymentRequests(),
        fetchStreamingPayments(),
      ]);
      calculateStats();
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTitles = async () => {
    if (!supabase) return;
    
    const { data, error } = await supabase
      .from('content')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching titles:', error);
      return;
    }
    
    setTitles(data || []);
  };

  const fetchFilmmakers = async () => {
    if (!supabase) return;
    
    console.log('Fetching filmmakers...');
    const { data: filmmakerData, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role')
      .eq('role', 'filmmaker')
      .order('first_name', { ascending: true });

    if (error) {
      console.error('Error fetching filmmakers:', error);
      return;
    }
    
    console.log('Fetched filmmakers:', filmmakerData);
    setFilmmakers(filmmakerData || []);
  };

  const fetchPaymentRequests = async () => {
    if (!supabase) return;
    
    const { data, error } = await supabase
      .from('payment_requests')
      .select(`
        *,
        filmmaker:users!payment_requests_filmmaker_id_fkey(first_name, last_name, email)
      `)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('Error fetching payment requests:', error);
      return;
    }
    
    setPaymentRequests(data || []);
  };

  const fetchStreamingPayments = async () => {
    if (!supabase) return;
    
    const { data, error } = await supabase
      .from('streaming_payments')
      .select(`
        *,
        content!inner(title_name)
      `)
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Error fetching streaming payments:', error);
      return;
    }
    
    setStreamingPayments(data || []);
  };

  const calculateStats = () => {
    const totalFilmmakers = filmmakers.length;
    const totalTitles = titles.length;
    const pendingApprovals = titles.filter(t => t.status === 'pending').length;
    const totalRevenue = streamingPayments.reduce((sum, payment) => sum + (payment.gross_amount || 0), 0);
    
    setStats({
      totalFilmmakers,
      totalTitles,
      totalRevenue,
      pendingApprovals,
    });
  };

  const handleAddTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('content')
        .insert({
          title_name: newTitle.title_name,
          content_type: newTitle.content_type,
          filmmaker_id: newTitle.filmmaker_id,
          description: newTitle.description || null,
          genre: newTitle.genre || null,
          release_date: newTitle.release_date || null,
          duration_minutes: newTitle.duration_minutes ? parseInt(newTitle.duration_minutes) : null,
          rating: newTitle.rating || null,
          status: 'pending',
        });

      if (error) throw error;

      // Reset form and refresh data
      setNewTitle({
        title_name: '',
        content_type: 'movie',
        filmmaker_id: '',
        description: '',
        genre: '',
        release_date: '',
        duration_minutes: '',
        rating: '',
      });
      setShowAddTitle(false);
      fetchDashboardData();
      alert('Title added successfully!');
    } catch (error) {
      console.error('Error adding title:', error);
      alert('Error adding title. Please try again.');
    }
  };

  const handleAddFilmmaker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    try {
      // Call the edge function to create filmmaker
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-filmmaker`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newFilmmaker.email,
          first_name: newFilmmaker.first_name,
          last_name: newFilmmaker.last_name,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          // User already exists
          alert(`User already exists: ${result.error}\n\nExisting user details:\nEmail: ${result.existing_user?.email}\nRole: ${result.existing_user?.role}`);
        } else {
          throw new Error(result.error || 'Failed to create filmmaker');
        }
        return;
      }

      // Reset form and refresh data
      setNewFilmmaker({
        email: '',
        first_name: '',
        last_name: '',
      });
      setShowAddFilmmaker(false);
      fetchDashboardData();
      alert(`Filmmaker created successfully! Temporary password: ${result.temporary_password}`);
    } catch (error) {
      console.error('Error adding filmmaker:', error);
      alert(`Error adding filmmaker: ${error.message}`);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

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

      // Reset form and refresh data
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
      alert('Payment added successfully!');
    } catch (error) {
      console.error('Error adding payment:', error);
      alert('Error adding payment. Please try again.');
    }
  };

  const handleApproveTitle = async (titleId: string) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('content')
        .update({ status: 'approved' })
        .eq('id', titleId);

      if (error) throw error;

      fetchDashboardData();
      alert('Title approved successfully!');
    } catch (error) {
      console.error('Error approving title:', error);
      alert('Error approving title. Please try again.');
    }
  };

  const handleRejectTitle = async (titleId: string) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('content')
        .update({ status: 'rejected' })
        .eq('id', titleId);

      if (error) throw error;

      fetchDashboardData();
      alert('Title rejected successfully!');
    } catch (error) {
      console.error('Error rejecting title:', error);
      alert('Error rejecting title. Please try again.');
    }
  };

  const handleApprovePayment = async (requestId: string, approvedAmount: number) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({ 
          status: 'approved',
          amount_approved: approvedAmount,
        })
        .eq('id', requestId);

      if (error) throw error;

      fetchDashboardData();
      alert('Payment request approved!');
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

  const chartData = streamingPayments.slice(0, 5).map(payment => ({
    title: payment.content.title_name.substring(0, 15) + (payment.content.title_name.length > 15 ? '...' : ''),
    amount: payment.gross_amount || 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <div className="flex space-x-2">
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
          value={stats.totalFilmmakers}
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
          title="Pending Approvals"
          value={stats.pendingApprovals}
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
                  <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Amount']} />
                  <Bar dataKey="amount" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No payments recorded yet</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Pending Title Approvals</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {titles.filter(title => title.status === 'pending').map((title) => (
                <div key={title.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{title.title_name}</p>
                    <p className="text-sm text-gray-500">{title.content_type}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      onClick={() => handleApproveTitle(title.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleRejectTitle(title.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {titles.filter(title => title.status === 'pending').length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Film className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No pending approvals</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Requests */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Payment Requests</h3>
        </CardHeader>
        <CardContent>
          {paymentRequests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Filmmaker
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paymentRequests.map((request: any) => (
                    <tr key={request.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {request.filmmaker?.first_name && request.filmmaker?.last_name
                          ? `${request.filmmaker.first_name} ${request.filmmaker.last_name}`
                          : request.filmmaker?.email || 'Unknown'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${request.amount_requested.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'approved' ? 'bg-green-100 text-green-800' :
                          request.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {request.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(request.requested_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {request.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => handleApprovePayment(request.id, request.amount_requested)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Approve
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No payment requests</h3>
              <p className="text-gray-500">Payment requests will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Title Modal */}
      {showAddTitle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <h3 className="text-lg font-semibold">Add New Title</h3>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddTitle} className="space-y-4">
                <Input
                  label="Title Name"
                  value={newTitle.title_name}
                  onChange={(e) => setNewTitle({ ...newTitle, title_name: e.target.value })}
                  required
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content Type
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filmmaker
                  </label>
                  <select
                    value={newTitle.filmmaker_id}
                    onChange={(e) => setNewTitle({ ...newTitle, filmmaker_id: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a filmmaker</option>
                    {filmmakers.length > 0 ? (
                      filmmakers.map((filmmaker) => (
                        <option key={filmmaker.id} value={filmmaker.id}>
                          {filmmaker.first_name && filmmaker.last_name
                            ? `${filmmaker.first_name} ${filmmaker.last_name}`
                            : filmmaker.email
                          }
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>No filmmakers found</option>
                    )}
                  </select>
                </div>

                <Input
                  label="Description"
                  value={newTitle.description}
                  onChange={(e) => setNewTitle({ ...newTitle, description: e.target.value })}
                />

                <Input
                  label="Genre"
                  value={newTitle.genre}
                  onChange={(e) => setNewTitle({ ...newTitle, genre: e.target.value })}
                />

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
                />

                <Input
                  label="Rating"
                  value={newTitle.rating}
                  onChange={(e) => setNewTitle({ ...newTitle, rating: e.target.value })}
                />

                <div className="flex space-x-2">
                  <Button type="submit" className="flex-1">Add Title</Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowAddTitle(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Filmmaker Modal */}
      {showAddFilmmaker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <h3 className="text-lg font-semibold">Add New Filmmaker</h3>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddFilmmaker} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  value={newFilmmaker.email}
                  onChange={(e) => setNewFilmmaker({ ...newFilmmaker, email: e.target.value })}
                  required
                />
                
                <Input
                  label="First Name"
                  value={newFilmmaker.first_name}
                  onChange={(e) => setNewFilmmaker({ ...newFilmmaker, first_name: e.target.value })}
                  required
                />

                <Input
                  label="Last Name"
                  value={newFilmmaker.last_name}
                  onChange={(e) => setNewFilmmaker({ ...newFilmmaker, last_name: e.target.value })}
                  required
                />

                <div className="flex space-x-2">
                  <Button type="submit" className="flex-1">Add Filmmaker</Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowAddFilmmaker(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <h3 className="text-lg font-semibold">Add New Payment</h3>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddPayment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <select
                    value={newPayment.title_id}
                    onChange={(e) => setNewPayment({ ...newPayment, title_id: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
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
                  required
                />

                <Input
                  label="Outlet"
                  value={newPayment.outlet}
                  onChange={(e) => setNewPayment({ ...newPayment, outlet: e.target.value })}
                />

                <Input
                  label="Payment Date"
                  type="date"
                  value={newPayment.payment_date}
                  onChange={(e) => setNewPayment({ ...newPayment, payment_date: e.target.value })}
                  required
                />

                <Input
                  label="Gross Amount"
                  type="number"
                  step="0.01"
                  value={newPayment.gross_amount}
                  onChange={(e) => setNewPayment({ ...newPayment, gross_amount: e.target.value })}
                  required
                />

                <Input
                  label="Distribution Percentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={newPayment.distribution_percentage}
                  onChange={(e) => setNewPayment({ ...newPayment, distribution_percentage: e.target.value })}
                  required
                />

                <Input
                  label="Notes"
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                />

                <div className="flex space-x-2">
                  <Button type="submit" className="flex-1">Add Payment</Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowAddPayment(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}