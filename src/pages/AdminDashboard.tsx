import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Film, DollarSign, Clock, Plus, Check, X, Edit, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { supabase, User, Content, PaymentRequest, StreamingPayment } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { FinancialDashboard } from '../components/FinancialDashboard';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'titles' | 'financial'>('overview');
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
  const [showEditTitle, setShowEditTitle] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [editingTitle, setEditingTitle] = useState<Content | null>(null);
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
    distribution_percentage: '20',
    previous_gross_amount: '',
    previous_expenses: '',
    previous_distribution_fee: '',
    previous_net_revenue: '',
    previous_amount_paid: '',
    previous_balance_due: '',
  });
  const [editTitle, setEditTitle] = useState({
    title_name: '',
    content_type: 'movie' as 'movie' | 'series' | 'episode',
    description: '',
    genre: '',
    release_date: '',
    duration_minutes: '',
    rating: '',
    filmmaker_id: '',
    distribution_percentage: '20',
    previous_gross_amount: '',
    previous_expenses: '',
    previous_distribution_fee: '',
    previous_net_revenue: '',
    previous_amount_paid: '',
    previous_balance_due: '',
  });
  const [newPayment, setNewPayment] = useState({
    title_id: '',
    platform: '',
    outlet: '',
    payment_date: '',
    gross_amount: '',
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

      // Fetch all content/titles with distribution settings
      const { data: titlesData, error: titlesError } = await supabase
        .from('content')
        .select(`
          *,
          filmmaker:users!content_filmmaker_id_fkey(first_name, last_name, email),
          title_distribution_settings(*)
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
      const { data, error } = await supabase
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
          previous_gross_amount: newTitle.previous_gross_amount ? parseFloat(newTitle.previous_gross_amount) : 0,
          previous_expenses: newTitle.previous_expenses ? parseFloat(newTitle.previous_expenses) : 0,
          previous_distribution_fee: newTitle.previous_distribution_fee ? parseFloat(newTitle.previous_distribution_fee) : 0,
          previous_net_revenue: newTitle.previous_net_revenue ? parseFloat(newTitle.previous_net_revenue) : 0,
          previous_amount_paid: newTitle.previous_amount_paid ? parseFloat(newTitle.previous_amount_paid) : 0,
          previous_balance_due: newTitle.previous_balance_due ? parseFloat(newTitle.previous_balance_due) : 0,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating title:', error);
        throw error;
      }

      // Create distribution settings for the title
      const companyPercentage = newTitle.distribution_percentage ? parseFloat(newTitle.distribution_percentage) : 20;
      const filmmakertPercentage = 100 - companyPercentage;

      const { error: distributionError } = await supabase
        .from('title_distribution_settings')
        .insert({
          title_id: data.id,
          company_percentage: companyPercentage,
          filmmaker_percentage: filmmakertPercentage,
        });

      if (distributionError) {
        console.error('Error creating distribution settings:', distributionError);
        // Don't throw here - title was created successfully, just log the error
      }

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
        distribution_percentage: '20',
        previous_gross_amount: '',
        previous_expenses: '',
        previous_distribution_fee: '',
        previous_net_revenue: '',
        previous_amount_paid: '',
        previous_balance_due: '',
      });
      setShowAddTitle(false);
      fetchDashboardData();
    } catch (error) {
      console.error('Error creating title:', error);
      alert('Error creating title. Please try again.');
    }
  };

  const handleEditTitle = (title: Content) => {
    setEditingTitle(title);
    setEditTitle({
      title_name: title.title_name,
      content_type: title.content_type,
      description: title.description || '',
      genre: title.genre || '',
      release_date: title.release_date || '',
      duration_minutes: title.duration_minutes?.toString() || '',
      rating: title.rating || '',
      filmmaker_id: title.filmmaker_id || '',
      distribution_percentage: title.title_distribution_settings?.[0]?.company_percentage?.toString() || '20',
      previous_gross_amount: title.previous_gross_amount?.toString() || '',
      previous_expenses: title.previous_expenses?.toString() || '',
      previous_distribution_fee: title.previous_distribution_fee?.toString() || '',
      previous_net_revenue: title.previous_net_revenue?.toString() || '',
      previous_amount_paid: title.previous_amount_paid?.toString() || '',
      previous_balance_due: title.previous_balance_due?.toString() || '',
    });
    setShowEditTitle(true);
  };

  const handleUpdateTitle = async () => {
    if (!editingTitle || !editTitle.title_name || !editTitle.filmmaker_id) {
      alert('Please fill in title name and select a filmmaker');
      return;
    }

    try {
      const { error } = await supabase
        .from('content')
        .update({
          title_name: editTitle.title_name,
          content_type: editTitle.content_type,
          description: editTitle.description || null,
          genre: editTitle.genre || null,
          release_date: editTitle.release_date || null,
          duration_minutes: editTitle.duration_minutes ? parseInt(editTitle.duration_minutes) : null,
          rating: editTitle.rating || null,
          filmmaker_id: editTitle.filmmaker_id,
          previous_gross_amount: editTitle.previous_gross_amount ? parseFloat(editTitle.previous_gross_amount) : 0,
          previous_expenses: editTitle.previous_expenses ? parseFloat(editTitle.previous_expenses) : 0,
          previous_distribution_fee: editTitle.previous_distribution_fee ? parseFloat(editTitle.previous_distribution_fee) : 0,
          previous_net_revenue: editTitle.previous_net_revenue ? parseFloat(editTitle.previous_net_revenue) : 0,
          previous_amount_paid: editTitle.previous_amount_paid ? parseFloat(editTitle.previous_amount_paid) : 0,
          previous_balance_due: editTitle.previous_balance_due ? parseFloat(editTitle.previous_balance_due) : 0,
        })
        .eq('id', editingTitle.id);

      if (error) throw error;

      // Update distribution settings
      const companyPercentage = editTitle.distribution_percentage ? parseFloat(editTitle.distribution_percentage) : 20;
      const filmmakertPercentage = 100 - companyPercentage;
       const { error: distributionError } = await supabase
          .from('title_distribution_settings')
          .upsert({
          title_id: editingTitle.id,
          company_percentage: companyPercentage,
          filmmaker_percentage: filmmakertPercentage,
         }, {
           onConflict: 'title_id'
         });

      if (distributionError) {
        console.error('Error updating distribution settings:', distributionError);
      }

      alert('Title updated successfully!');
      setShowEditTitle(false);
      setEditingTitle(null);
      fetchDashboardData();
    } catch (error) {
      console.error('Error updating title:', error);
      alert('Error updating title. Please try again.');
    }
  };

  const handleAddPayment = async () => {
    if (!newPayment.title_id || !newPayment.platform || !newPayment.payment_date || !newPayment.gross_amount) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      // Get the title's distribution settings
      const { data: titleData, error: titleError } = await supabase
        .from('content')
        .select(`
          *,
          title_distribution_settings(*)
        `)
        .eq('id', newPayment.title_id)
        .single();

      if (titleError) throw titleError;

      // Use the title's distribution percentage, default to 50% if not set
      const distributionPercentage = titleData.title_distribution_settings?.[0]?.company_percentage || 50;

      const { error } = await supabase
        .from('streaming_payments')
        .insert({
          title_id: newPayment.title_id,
          platform: newPayment.platform,
          outlet: newPayment.outlet || null,
          payment_date: newPayment.payment_date,
          gross_amount: parseFloat(newPayment.gross_amount),
          distribution_percentage: distributionPercentage,
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
        <div className="flex items-center space-x-3">
          {/* Tab Navigation */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('financial')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'financial'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Financial
            </button>
          </div>
          
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

      {/* Render content based on active tab */}
      {activeTab === 'financial' ? (
        <FinancialDashboard userRole="admin" />
      ) : (
        <>
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

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
              title="Pending Requests"
              value={stats.pendingRequests}
              color="bg-orange-600"
            />
          </div>

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
                          {request.filmmaker?.first_name} {request.filmmaker?.last_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          ${request.amount_requested.toLocaleString()} requested
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
                          Distribution
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Revenue
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
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
                            {title.title_distribution_settings && title.title_distribution_settings.length > 0 
                              ? `${title.title_distribution_settings[0].company_percentage}% / ${title.title_distribution_settings[0].filmmaker_percentage}%`
                              : 'Not set'
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ${title.revenue_total.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleEditTitle(title)}
                              className="flex items-center space-x-1"
                            >
                              <Edit className="h-3 w-3" />
                              <span>Edit</span>
                            </Button>
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
        </>
      )}

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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Add New Title</h3>
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">Basic Information</h4>
                  <Input
                    label="Title Name"
                    value={newTitle.title_name}
                    onChange={(e) => setNewTitle({ ...newTitle, title_name: e.target.value })}
                    placeholder="Enter title name"
                  />
                  <div className="grid grid-cols-2 gap-4">
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
                
                {/* Distribution Settings */}
                <div className="border-t pt-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Distribution Settings</h4>
                  <div className="grid grid-cols-1 gap-4">
                    <Input
                      label="Company Distribution Percentage (%)"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={newTitle.distribution_percentage}
                      onChange={(e) => setNewTitle({ ...newTitle, distribution_percentage: e.target.value })}
                      placeholder="20"
                    />
                    <p className="text-xs text-gray-500">
                      Percentage of payments that goes to the company. Filmmaker receives the remaining percentage.
                      Example: 20% means company gets 20%, filmmaker gets 80%.
                    </p>
                  </div>
                </div>

                {/* Historical Accounting Data */}
                <div className="border-t pt-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Historical Accounting Data</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Enter financial data from your previous system to maintain complete records.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Previous Gross Amount"
                      type="number"
                      step="0.01"
                      value={newTitle.previous_gross_amount}
                      onChange={(e) => setNewTitle({ ...newTitle, previous_gross_amount: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Expenses"
                      type="number"
                      step="0.01"
                      value={newTitle.previous_expenses}
                      onChange={(e) => setNewTitle({ ...newTitle, previous_expenses: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Distribution Fee"
                      type="number"
                      step="0.01"
                      value={newTitle.previous_distribution_fee}
                      onChange={(e) => setNewTitle({ ...newTitle, previous_distribution_fee: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Net Revenue"
                      type="number"
                      step="0.01"
                      value={newTitle.previous_net_revenue}
                      onChange={(e) => setNewTitle({ ...newTitle, previous_net_revenue: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Amount Paid"
                      type="number"
                      step="0.01"
                      value={newTitle.previous_amount_paid}
                      onChange={(e) => setNewTitle({ ...newTitle, previous_amount_paid: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Balance Due"
                      type="number"
                      step="0.01"
                      value={newTitle.previous_balance_due}
                      onChange={(e) => setNewTitle({ ...newTitle, previous_balance_due: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
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

      {/* Edit Title Modal */}
      {showEditTitle && editingTitle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Edit Title: {editingTitle.title_name}</h3>
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">Basic Information</h4>
                  <Input
                    label="Title Name"
                    value={editTitle.title_name}
                    onChange={(e) => setEditTitle({ ...editTitle, title_name: e.target.value })}
                    placeholder="Enter title name"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                      <select
                        value={editTitle.content_type}
                        onChange={(e) => setEditTitle({ ...editTitle, content_type: e.target.value as 'movie' | 'series' | 'episode' })}
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
                        value={editTitle.filmmaker_id}
                        onChange={(e) => setEditTitle({ ...editTitle, filmmaker_id: e.target.value })}
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
                  </div>
                  <Input
                    label="Description"
                    value={editTitle.description}
                    onChange={(e) => setEditTitle({ ...editTitle, description: e.target.value })}
                    placeholder="Enter description (optional)"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Genre"
                      value={editTitle.genre}
                      onChange={(e) => setEditTitle({ ...editTitle, genre: e.target.value })}
                      placeholder="e.g., Drama, Comedy"
                    />
                    <Input
                      label="Rating"
                      value={editTitle.rating}
                      onChange={(e) => setEditTitle({ ...editTitle, rating: e.target.value })}
                      placeholder="e.g., PG-13, R"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Release Date"
                      type="date"
                      value={editTitle.release_date}
                      onChange={(e) => setEditTitle({ ...editTitle, release_date: e.target.value })}
                    />
                    <Input
                      label="Duration (minutes)"
                      type="number"
                      value={editTitle.duration_minutes}
                      onChange={(e) => setEditTitle({ ...editTitle, duration_minutes: e.target.value })}
                      placeholder="120"
                    />
                  </div>
                </div>
                
                {/* Distribution Settings */}
                <div className="border-t pt-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Distribution Settings</h4>
                  <div className="grid grid-cols-1 gap-4">
                    <Input
                      label="Company Distribution Percentage (%)"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={editTitle.distribution_percentage}
                      onChange={(e) => setEditTitle({ ...editTitle, distribution_percentage: e.target.value })}
                      placeholder="20"
                    />
                    <p className="text-xs text-gray-500">
                      Percentage of payments that goes to the company. Filmmaker receives the remaining percentage.
                      Example: 20% means company gets 20%, filmmaker gets 80%.
                    </p>
                  </div>
                </div>

                {/* Historical Accounting Data */}
                <div className="border-t pt-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Historical Accounting Data</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Update financial data from your previous system.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Previous Gross Amount"
                      type="number"
                      step="0.01"
                      value={editTitle.previous_gross_amount}
                      onChange={(e) => setEditTitle({ ...editTitle, previous_gross_amount: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Expenses"
                      type="number"
                      step="0.01"
                      value={editTitle.previous_expenses}
                      onChange={(e) => setEditTitle({ ...editTitle, previous_expenses: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Distribution Fee"
                      type="number"
                      step="0.01"
                      value={editTitle.previous_distribution_fee}
                      onChange={(e) => setEditTitle({ ...editTitle, previous_distribution_fee: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Net Revenue"
                      type="number"
                      step="0.01"
                      value={editTitle.previous_net_revenue}
                      onChange={(e) => setEditTitle({ ...editTitle, previous_net_revenue: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Amount Paid"
                      type="number"
                      step="0.01"
                      value={editTitle.previous_amount_paid}
                      onChange={(e) => setEditTitle({ ...editTitle, previous_amount_paid: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Balance Due"
                      type="number"
                      step="0.01"
                      value={editTitle.previous_balance_due}
                      onChange={(e) => setEditTitle({ ...editTitle, previous_balance_due: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <Button variant="secondary" onClick={() => setShowEditTitle(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateTitle}>
                  Update Title
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
                        {title.title_name} ({title.title_distribution_settings?.[0]?.company_percentage || 50}% company split)
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
                  label="Notes (optional)"
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                  placeholder="Additional notes"
                />
                <p className="text-xs text-gray-500">
                  Distribution percentage will be automatically applied based on the selected title's settings.
                </p>
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