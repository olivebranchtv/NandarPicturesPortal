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
    distribution_percentage: '25',
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
      const companyPercentage = newTitle.distribution_percentage ? parseFloat(newTitle.distribution_percentage) : 25;
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
        distribution_percentage: '25',
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
    
    // Get the distribution percentage from the title's distribution settings
    const distributionPercentage = title.title_distribution_settings && title.title_distribution_settings.length > 0
      ? title.title_distribution_settings[0].company_percentage.toString()
      : '';
    
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
      const companyPercentage = editTitle.distribution_percentage ? parseFloat(editTitle.distribution_percentage) : 25;
      const filmmakerPercentage = 100 - companyPercentage;

      console.log('Updating distribution settings:', {
        title_id: editingTitle.id,
        company_percentage: companyPercentage,
        filmmaker_percentage: filmmakerPercentage
      });

      const { error: distributionError } = await supabase
        .from('title_distribution_settings')
        .upsert([{
          title_id: editingTitle.id,
          company_percentage: companyPercentage,
          filmmaker_percentage: filmmakerPercentage,
        }], {
          onConflict: 'title_id',
          ignoreDuplicates: false
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
      const distributionPercentage = titleData.title_distribution_settings?.[0]?.company_percentage || 25;

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
        </>
      )}
    </div>
  );
}