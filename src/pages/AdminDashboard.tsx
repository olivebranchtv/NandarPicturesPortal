import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, Film, DollarSign, Clock, TrendingUp, AlertCircle, Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { supabase, Content, PaymentRequest, User, StreamingPayment, FilmmakerBalance } from '../lib/supabase';

interface PaymentFormData {
  title_id: string;
  platform: string;
  outlet: string;
  payment_date: string;
  gross_amount: string;
  notes: string;
}

interface TitleFormData {
  title_name: string;
  content_type: 'movie' | 'series' | 'episode';
  filmmaker_id: string;
  description: string;
  genre: string;
  release_date: string;
  duration_minutes: string;
  rating: string;
  company_percentage: string;
  initial_revenue_total: string;
  initial_expenses_total: string;
}

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
  const [recentTitles, setRecentTitles] = useState<Content[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PaymentRequest[]>([]);
  const [allPaymentRequests, setAllPaymentRequests] = useState<PaymentRequest[]>([]);
  const [streamingPayments, setStreamingPayments] = useState<StreamingPayment[]>([]);
  const [filmmakerBalances, setFilmmakerBalances] = useState<FilmmakerBalance[]>([]);
  const [allFilmmakers, setAllFilmmakers] = useState<User[]>([]);
  const [allTitles, setAllTitles] = useState<Content[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showTitleForm, setShowTitleForm] = useState(false);
  const [showManageRequestModal, setShowManageRequestModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<StreamingPayment | null>(null);
  const [editingTitle, setEditingTitle] = useState<Content | null>(null);
  const [currentRequest, setCurrentRequest] = useState<PaymentRequest | null>(null);
  const [modalAmountApproved, setModalAmountApproved] = useState('');
  const [filmmakers, setFilmmakers] = useState<User[]>([]);
  const [modalPaymentMethod, setModalPaymentMethod] = useState('');
  const [modalPaymentDate, setModalPaymentDate] = useState('');
  const [modalAdminNotes, setModalAdminNotes] = useState('');
  const [showNewFilmmakerForm, setShowNewFilmmakerForm] = useState(false);
  const [newFilmmakerEmail, setNewFilmmakerEmail] = useState('');
  const [newFilmmakerFirstName, setNewFilmmakerFirstName] = useState('');
  const [newFilmmakerLastName, setNewFilmmakerLastName] = useState('');
  const [newFilmmakerError, setNewFilmmakerError] = useState('');
  const [newFilmmakerSuccess, setNewFilmmakerSuccess] = useState('');
  const [creatingFilmmaker, setCreatingFilmmaker] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>({
    title_id: '',
    platform: '',
    outlet: '',
    payment_date: '',
    gross_amount: '',
    notes: ''
  });
  const [titleForm, setTitleForm] = useState<TitleFormData>({
    title_name: '',
    content_type: 'movie',
    filmmaker_id: '',
    description: '',
    genre: '',
    release_date: '',
    duration_minutes: '',
    rating: '',
    previous_gross_amount: '',
    previous_expenses: '',
    previous_distribution_fee: '',
    previous_net_revenue: '',
    previous_amount_paid: '',
    previous_balance_due: '',
    company_percentage: '50'
  });

  useEffect(() => {
    fetchDashboardData();
    fetchFilmmakers();
  }, []);

  const fetchFilmmakers = async () => {
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'filmmaker')
        .order('first_name', { ascending: true });

      if (error) throw error;
      setFilmmakers(data || []);
    } catch (error) {
      console.error('Error fetching filmmakers:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Fetch stats
      const [titlesResult, usersResult, paymentsResult, allRequestsResult, streamingResult, balancesResult, filmmakersResult] = await Promise.all([
        supabase.from('content').select('revenue_total'),
        supabase.from('users').select('id').eq('role', 'filmmaker'),
        supabase.from('payment_requests').select('*').eq('status', 'pending'),
        supabase.from('payment_requests').select(`
          *,
          users!payment_requests_filmmaker_id_fkey(first_name, last_name, email)
        `).order('requested_at', { ascending: false }),
        supabase.from('streaming_payments').select(`
          *,
          content!inner(title_name, filmmaker_id)
        `).order('payment_date', { ascending: false }),
        supabase.from('filmmaker_balances').select(`
          *,
          users!inner(first_name, last_name, email)
        `),
        supabase.from('users').select('*').eq('role', 'filmmaker')
      ]);

      if (titlesResult.error) throw titlesResult.error;
      if (usersResult.error) throw usersResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (allRequestsResult.error) throw allRequestsResult.error;
      if (streamingResult.error) throw streamingResult.error;
      if (balancesResult.error) throw balancesResult.error;
      if (filmmakersResult.error) throw filmmakersResult.error;

      const totalRevenue = titlesResult.data?.reduce((sum, title) => sum + (title.revenue_total || 0), 0) || 0;

      setStats({
        totalTitles: titlesResult.data?.length || 0,
        totalFilmmakers: usersResult.data?.length || 0,
        totalRevenue,
        pendingPayments: paymentsResult.data?.length || 0,
      });

      setPendingRequests(paymentsResult.data || []);
      setAllPaymentRequests(allRequestsResult.data?.map(req => ({
        ...req,
        filmmaker: req.users
      })) || []);
      setStreamingPayments(streamingResult.data || []);
      setFilmmakerBalances(balancesResult.data || []);
      setAllFilmmakers(filmmakersResult.data || []);

      // Fetch recent titles with filmmaker info
      const { data: allTitlesData, error: titlesError } = await supabase
        .from('content')
        .select(`
          *,
          users!content_filmmaker_id_fkey (first_name, last_name, email),
          title_distribution_settings (company_percentage, filmmaker_percentage)
        `)
        .order('created_at', { ascending: false });

      if (titlesError) throw titlesError;
      setAllTitles(allTitlesData || []);
      setRecentTitles(allTitlesData?.slice(0, 5) || []);

      // Create sample revenue data for chart
      const chartData = streamingResult.data?.slice(0, 5).map(payment => ({
        title: payment.content.title_name.substring(0, 15) + (payment.content.title_name.length > 15 ? '...' : ''),
        gross: payment.gross_amount || 0,
        net: payment.net_amount || 0,
      })) || [];

      setRevenueData(chartData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenManageRequestModal = (request: PaymentRequest) => {
    setCurrentRequest(request);
    setModalAmountApproved(request.amount_approved?.toString() || request.amount_requested.toString());
    setModalPaymentMethod(request.payment_method_used || '');
    setModalPaymentDate(request.date_paid || '');
    setModalAdminNotes(request.admin_notes || '');
    setShowManageRequestModal(true);
  };

  const handleCloseManageRequestModal = () => {
    setShowManageRequestModal(false);
    setCurrentRequest(null);
    setModalAmountApproved('');
    setModalPaymentMethod('');
    setModalPaymentDate('');
    setModalAdminNotes('');
  };

  const handleCreateNewFilmmaker = async () => {
    setNewFilmmakerError('');
    setNewFilmmakerSuccess('');

    // Validate required fields
    if (!newFilmmakerEmail || !newFilmmakerFirstName || !newFilmmakerLastName) {
      setNewFilmmakerError('All fields are required');
      return;
    }

    try {
      // Generate a temporary password
      const tempPassword = 'TempPass123!';
      
      // Create the user account
      const { data, error } = await supabase.auth.signUp({
        email: newFilmmakerEmail,
        password: tempPassword,
        options: {
          data: {
            first_name: newFilmmakerFirstName,
            last_name: newFilmmakerLastName,
            role: 'filmmaker'
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        setNewFilmmakerSuccess(`Filmmaker created successfully! Temporary password: ${tempPassword}`);
        console.warn(`New filmmaker created: ${newFilmmakerEmail} with temporary password: ${tempPassword}`);
        
        // Clear form
        setNewFilmmakerEmail('');
        setNewFilmmakerFirstName('');
        setNewFilmmakerLastName('');
        
        // Hide form after a delay
        setTimeout(() => {
          setShowNewFilmmakerForm(false);
          setNewFilmmakerSuccess('');
        }, 3000);
        
        // Refresh filmmakers list
        await fetchDashboardData();
        // Refresh filmmakers list
        fetchFilmmakers();
        
        // Select the newly created filmmaker
        setTitleForm({...titleForm, filmmaker_id: data.user.id});
      }
    } catch (error) {
      console.error('Error creating filmmaker:', error);
      setNewFilmmakerError(error.message || 'Error creating filmmaker');
    }
  };

  const handleUpdateRequestStatus = async (status: 'approved' | 'rejected' | 'paid') => {
    if (!currentRequest) return;

    try {
      const updateData: any = {
        status,
        admin_notes: modalAdminNotes || null,
      };

      if (status === 'approved' || status === 'paid') {
        updateData.amount_approved = parseFloat(modalAmountApproved);
      }

      if (status === 'paid') {
        updateData.payment_method_used = modalPaymentMethod;
        updateData.date_paid = modalPaymentDate;
      }

      const { error } = await supabase
        .from('payment_requests')
        .update(updateData)
        .eq('id', currentRequest.id);

      if (error) throw error;

      handleCloseManageRequestModal();
      fetchDashboardData();
      alert(`Payment request ${status} successfully!`);
    } catch (error) {
      console.error('Error updating payment request:', error);
      alert('Error updating payment request. Please try again.');
    }
  };

  const handleTitleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const titleData = {
        title_name: titleForm.title_name,
        content_type: titleForm.content_type,
        filmmaker_id: titleForm.filmmaker_id,
        description: titleForm.description || null,
        genre: titleForm.genre || null,
        release_date: titleForm.release_date || null,
        duration_minutes: titleForm.duration_minutes ? parseInt(titleForm.duration_minutes) : null,
        rating: titleForm.rating || null,
        status: 'approved' // Admin-added titles are automatically approved
      };

      let titleId: string;

      if (editingTitle) {
        const { error } = await supabase
          .from('content')
          .update(titleData)
          .eq('id', editingTitle.id);
        
        if (error) throw error;
        titleId = editingTitle.id;
      } else {
        const { data, error } = await supabase
          .from('content')
          .insert(titleData)
          .select('id')
          .single();
        
        if (error) throw error;
        titleId = data.id;
      }

      // Handle distribution settings
      const companyPercentage = parseFloat(titleForm.company_percentage);
      const filmmakerPercentage = 100 - companyPercentage;

      const distributionData = {
        title_id: titleId,
        company_percentage: companyPercentage,
        filmmaker_percentage: filmmakerPercentage
      };

      if (editingTitle) {
        // Update existing distribution settings
        const { error: distError } = await supabase
          .from('title_distribution_settings')
          .upsert(distributionData);
        
        if (distError) throw distError;
      } else {
        // Insert new distribution settings
        const { error: distError } = await supabase
          .from('title_distribution_settings')
          .insert(distributionData);
        
        if (distError) throw distError;
      }

      // Reset form and refresh data
      setTitleForm({
        title_name: '',
        content_type: 'movie',
        filmmaker_id: '',
        description: '',
        genre: '',
        release_date: '',
        duration_minutes: '',
        rating: '',
        previous_gross_amount: '',
        previous_expenses: '',
        previous_distribution_fee: '',
        previous_net_revenue: '',
        previous_amount_paid: '',
        previous_balance_due: '',
        previous_gross_amount: title.previous_gross_amount?.toString() || '0',
        previous_expenses: title.previous_expenses?.toString() || '0',
        previous_distribution_fee: title.previous_distribution_fee?.toString() || '0',
        previous_net_revenue: title.previous_net_revenue?.toString() || '0',
        previous_amount_paid: title.previous_amount_paid?.toString() || '0',
        previous_balance_due: title.previous_balance_due?.toString() || '0',
        company_percentage: '50'
      });
      setShowTitleForm(false);
      setEditingTitle(null);
      fetchDashboardData();
    } catch (error) {
      console.error('Error saving title:', error);
      alert('Error saving title. Please try again.');
    }
  };

  const handleEditTitle = (title: Content) => {
    setEditingTitle(title);
    setShowNewFilmmakerForm(false);
    const distributionSettings = title.title_distribution_settings?.[0];
    setTitleForm({
      title_name: title.title_name,
      content_type: title.content_type,
      filmmaker_id: title.filmmaker_id || '',
      description: title.description || '',
      genre: title.genre || '',
      release_date: title.release_date || '',
      duration_minutes: title.duration_minutes?.toString() || '',
      rating: title.rating || '',
      company_percentage: distributionSettings?.company_percentage?.toString() || '50'
    });
    setShowTitleForm(true);
  };

  const handleDeleteTitle = async (titleId: string) => {
    if (!confirm('Are you sure you want to delete this title? This will also delete all associated payments and data.')) return;
    
    try {
      const { error } = await supabase
        .from('content')
        .delete()
        .eq('id', titleId);
      
      if (error) throw error;
      fetchDashboardData();
    } catch (error) {
      console.error('Error deleting title:', error);
      alert('Error deleting title. Please try again.');
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const paymentData = {
        title_id: paymentForm.title_id,
        platform: paymentForm.platform,
        outlet: paymentForm.outlet || null,
        payment_date: paymentForm.payment_date,
        gross_amount: parseFloat(paymentForm.gross_amount),
        notes: paymentForm.notes || null
      };

      if (editingPayment) {
        const { error } = await supabase
          .from('streaming_payments')
          .update(paymentData)
          .eq('id', editingPayment.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('streaming_payments')
          .insert(paymentData);
        
        if (error) throw error;
      }

      // Reset form and refresh data
      setPaymentForm({
        title_id: '',
        platform: '',
        outlet: '',
        payment_date: '',
        gross_amount: '',
        notes: ''
      });
      setShowPaymentForm(false);
      setEditingPayment(null);
      fetchDashboardData();
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Error saving payment. Please try again.');
    }
  };

  const handleEditPayment = (payment: StreamingPayment) => {
    setEditingPayment(payment);
    setPaymentForm({
      title_id: payment.title_id,
      platform: payment.platform,
      outlet: payment.outlet || '',
      payment_date: payment.payment_date,
      gross_amount: payment.gross_amount.toString(),
      notes: payment.notes || ''
    });
    setShowPaymentForm(true);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment?')) return;
    
    try {
      const { error } = await supabase
        .from('streaming_payments')
        .delete()
        .eq('id', paymentId);
      
      if (error) throw error;
      fetchDashboardData();
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Error deleting payment. Please try again.');
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
        {/* Title Management Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Title Management</h3>
              <Button
                onClick={() => {
                  setShowTitleForm(!showTitleForm);
                  setEditingTitle(null);
                  setShowNewFilmmakerForm(false);
                  setTitleForm({
                    title_name: '',
                    content_type: 'movie',
                    filmmaker_id: '',
                    description: '',
                    genre: '',
                    release_date: '',
                    duration_minutes: '',
                    rating: '',
                    company_percentage: '50'
                  });
                }}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Title
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showTitleForm && (
              <form onSubmit={handleTitleSubmit} className="space-y-4 mb-6">
                <Input
                  label="Title Name"
                  value={titleForm.title_name}
                  onChange={(e) => setTitleForm({...titleForm, title_name: e.target.value})}
                  placeholder="Enter title name"
                  required
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content Type
                  </label>
                  <select
                    value={titleForm.content_type}
                    onChange={(e) => setTitleForm({...titleForm, content_type: e.target.value as 'movie' | 'series' | 'episode'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
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
                    value={titleForm.filmmaker_id}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'create-new-filmmaker') {
                        setShowNewFilmmakerForm(true);
                        setTitleForm({...titleForm, filmmaker_id: ''});
                      } else {
                        setShowNewFilmmakerForm(false);
                        setTitleForm({...titleForm, filmmaker_id: value});
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a filmmaker</option>
                    <option value="create-new-filmmaker">+ Create New Filmmaker...</option>
                    {allFilmmakers.map(filmmaker => (
                      <option key={filmmaker.id} value={filmmaker.id}>
                        {filmmaker.first_name && filmmaker.last_name 
                          ? `${filmmaker.first_name} ${filmmaker.last_name} (${filmmaker.email})`
                          : filmmaker.email
                        }
                      </option>
                    ))}
                  </select>
                </div>
                
                {showNewFilmmakerForm && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h4 className="font-medium text-gray-900 mb-3">Create New Filmmaker</h4>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <Input
                        label="First Name"
                        value={newFilmmakerFirstName}
                        onChange={(e) => setNewFilmmakerFirstName(e.target.value)}
                        placeholder="Enter first name"
                        required
                      />
                      
                      <Input
                        label="Last Name"
                        value={newFilmmakerLastName}
                        onChange={(e) => setNewFilmmakerLastName(e.target.value)}
                        placeholder="Enter last name"
                        required
                      />
                    </div>
                    
                    <Input
                      type="email"
                      label="Email"
                      value={newFilmmakerEmail}
                      onChange={(e) => setNewFilmmakerEmail(e.target.value)}
                      placeholder="Enter email address"
                      required
                      className="mb-4"
                    />

                    {/* Historical Accounting Data Section */}
                    <div className="col-span-2 border-t pt-6">
                      <h4 className="text-lg font-medium text-gray-900 mb-4">
                        Historical Accounting Data
                      </h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Enter historical financial data from your previous system for this title.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          type="number"
                          step="0.01"
                          label="Previous Gross Amount"
                          value={titleForm.previous_gross_amount}
                          onChange={(e) => setTitleForm({ ...titleForm, previous_gross_amount: e.target.value })}
                          placeholder="0.00"
                        />
                        
                        <Input
                          type="number"
                          step="0.01"
                          label="Previous Expenses"
                          value={titleForm.previous_expenses}
                          onChange={(e) => setTitleForm({ ...titleForm, previous_expenses: e.target.value })}
                          placeholder="0.00"
                        />
                        
                        <Input
                          type="number"
                          step="0.01"
                          label="Previous Distribution Fee"
                          value={titleForm.previous_distribution_fee}
                          onChange={(e) => setTitleForm({ ...titleForm, previous_distribution_fee: e.target.value })}
                          placeholder="0.00"
                        />
                        
                        <Input
                          type="number"
                          step="0.01"
                          label="Previous Net Revenue"
                          value={titleForm.previous_net_revenue}
                          onChange={(e) => setTitleForm({ ...titleForm, previous_net_revenue: e.target.value })}
                          placeholder="0.00"
                        />
                        
                        <Input
                          type="number"
                          step="0.01"
                          label="Previous Amount Paid to Filmmakers"
                          value={titleForm.previous_amount_paid}
                          onChange={(e) => setTitleForm({ ...titleForm, previous_amount_paid: e.target.value })}
                          placeholder="0.00"
                        />
                        
                        <Input
                          type="number"
                          step="0.01"
                          label="Previous Balance Due"
                          value={titleForm.previous_balance_due}
                          onChange={(e) => setTitleForm({ ...titleForm, previous_balance_due: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    {newFilmmakerError && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                        <p className="text-sm text-red-600">{newFilmmakerError}</p>
                      </div>
                    )}

                    {newFilmmakerSuccess && (
                      <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
                        <p className="text-sm text-green-600">{newFilmmakerSuccess}</p>
                      </div>
                    )}
                    
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        onClick={handleCreateNewFilmmaker}
                        size="sm"
                        disabled={creatingFilmmaker}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {creatingFilmmaker ? 'Creating...' : 'Create Filmmaker'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setShowNewFilmmakerForm(false);
                          setNewFilmmakerEmail('');
                          setNewFilmmakerFirstName('');
                          setNewFilmmakerLastName('');
                          setNewFilmmakerError('');
                          setNewFilmmakerSuccess('');
                          setTitleForm({...titleForm, filmmaker_id: ''});
                        }}
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={titleForm.description}
                    onChange={(e) => setTitleForm({...titleForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Brief description of the title"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Genre"
                    value={titleForm.genre}
                    onChange={(e) => setTitleForm({...titleForm, genre: e.target.value})}
                    placeholder="e.g., Drama, Comedy"
                  />
                  
                  <Input
                    label="Rating"
                    value={titleForm.rating}
                    onChange={(e) => setTitleForm({...titleForm, rating: e.target.value})}
                    placeholder="e.g., PG-13, R"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="date"
                    label="Release Date"
                    value={titleForm.release_date}
                    onChange={(e) => setTitleForm({...titleForm, release_date: e.target.value})}
                  />
                  
                  <Input
                    type="number"
                    label="Duration (minutes)"
                    value={titleForm.duration_minutes}
                    onChange={(e) => setTitleForm({...titleForm, duration_minutes: e.target.value})}
                    placeholder="120"
                  />
                </div>
                
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  label="Company Distribution Percentage (%)"
                  value={titleForm.company_percentage}
                  onChange={(e) => setTitleForm({...titleForm, company_percentage: e.target.value})}
                  placeholder="50"
                  required
                />
                <p className="text-xs text-gray-500 -mt-3">
                  Filmmaker will receive {100 - parseFloat(titleForm.company_percentage || '0')}% of payments
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    label="Initial Revenue Balance ($)"
                    value={titleForm.initial_revenue_total}
                    onChange={(e) => setTitleForm({...titleForm, initial_revenue_total: e.target.value})}
                    placeholder="0.00"
                  />
                  
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    label="Initial Expense Balance ($)"
                    value={titleForm.initial_expenses_total}
                    onChange={(e) => setTitleForm({...titleForm, initial_expenses_total: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-gray-500 -mt-3">
                  Enter previous revenue and expenses from your old accounting system
                </p>
                
                <div className="flex space-x-2">
                  <Button type="submit">
                    <Save className="h-4 w-4 mr-2" />
                    {editingTitle ? 'Update Title' : 'Add Title'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowTitleForm(false);
                      setEditingTitle(null);
                      setShowNewFilmmakerForm(false);
                      setNewFilmmakerEmail('');
                      setNewFilmmakerFirstName('');
                      setNewFilmmakerLastName('');
                      setNewFilmmakerError('');
                      setNewFilmmakerSuccess('');
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            
            {/* Recent Titles List */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Recent Titles</h4>
              {allTitles.slice(0, 5).map((title: any) => (
                <div key={title.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      {title.title_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {title.content_type} • {title.genre || 'No genre'} • 
                      Company: {title.title_distribution_settings?.[0]?.company_percentage || 50}%
                    </p>
                    <p className="text-sm text-gray-600">
                      Filmmaker: {title.users?.first_name && title.users?.last_name 
                        ? `${title.users.first_name} ${title.users.last_name}`
                        : title.users?.email || 'Unassigned'
                      }
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleEditTitle(title)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeleteTitle(title.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
                <Bar dataKey="gross" fill="#3B82F6" name="Gross Revenue" />
                <Bar dataKey="net" fill="#10B981" name="Net to Filmmaker" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Manage Payment Requests */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              Manage Payment Requests
            </h3>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {allPaymentRequests.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No payment requests</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Filmmaker
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount Requested
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Requested Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {allPaymentRequests.map((request) => (
                      <tr key={request.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {request.filmmaker?.first_name && request.filmmaker?.last_name 
                            ? `${request.filmmaker.first_name} ${request.filmmaker.last_name}`
                            : request.filmmaker?.email
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${request.amount_requested.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <Button
                            size="sm"
                            onClick={() => handleOpenManageRequestModal(request)}
                          >
                            Manage
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Management Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Payment Form */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Streaming Payments</h3>
              <Button
                onClick={() => {
                  setShowPaymentForm(!showPaymentForm);
                  setEditingPayment(null);
                  setPaymentForm({
                    title_id: '',
                    platform: '',
                    outlet: '',
                    payment_date: '',
                    gross_amount: '',
                    notes: ''
                  });
                }}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Payment
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showPaymentForm && (
              <form onSubmit={handlePaymentSubmit} className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <select
                    value={paymentForm.title_id}
                    onChange={(e) => setPaymentForm({...paymentForm, title_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a title</option>
                    {allTitles.map(title => (
                      <option key={title.id} value={title.id}>
                        {title.title_name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <Input
                  label="Platform"
                  value={paymentForm.platform}
                  onChange={(e) => setPaymentForm({...paymentForm, platform: e.target.value})}
                  placeholder="e.g., Netflix, Hulu, Amazon Prime"
                  required
                />
                
                <Input
                  label="Outlet (Optional)"
                  value={paymentForm.outlet}
                  onChange={(e) => setPaymentForm({...paymentForm, outlet: e.target.value})}
                  placeholder="e.g., Specific channel or service"
                />
                
                <Input
                  type="date"
                  label="Payment Date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({...paymentForm, payment_date: e.target.value})}
                  required
                />
                
                <Input
                  type="number"
                  step="0.01"
                  label="Gross Amount"
                  value={paymentForm.gross_amount}
                  onChange={(e) => setPaymentForm({...paymentForm, gross_amount: e.target.value})}
                  placeholder="0.00"
                  required
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Additional notes about this payment"
                  />
                </div>
                
                <div className="flex space-x-2">
                  <Button type="submit">
                    {editingPayment ? 'Update Payment' : 'Add Payment'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowPaymentForm(false);
                      setEditingPayment(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            
            {/* Recent Payments List */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Recent Payments</h4>
              {streamingPayments.slice(0, 5).map((payment: any) => (
                <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      {payment.content.title_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {payment.platform} • {new Date(payment.payment_date).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      Gross: ${payment.gross_amount.toLocaleString()} → Net: ${payment.net_amount.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleEditPayment(payment)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeletePayment(payment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Filmmaker Balances */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Filmmaker Balances</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filmmakerBalances.map((balance: any) => (
                <div key={balance.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {balance.users?.first_name && balance.users?.last_name 
                          ? `${balance.users.first_name} ${balance.users.last_name}`
                          : balance.users?.email
                        }
                      </p>
                      <p className="text-sm text-gray-500">
                        Earned: ${balance.total_earned.toLocaleString()} • 
                        Paid: ${balance.total_paid.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-gray-900">
                        ${balance.available_balance.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">Available</p>
                    </div>
                  </div>
                </div>
              ))}
              {filmmakerBalances.length === 0 && (
                <p className="text-gray-500 text-center py-4">No filmmaker balances yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Titles */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">All Titles</h3>
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
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Filmmaker
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Genre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Split (Co/Film)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {allTitles.map((title: any) => (
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
                      {title.users?.first_name && title.users?.last_name 
                        ? `${title.users.first_name} ${title.users.last_name}`
                        : title.users?.email || 'Unassigned'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {title.genre || 'Not specified'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${title.revenue_total?.toLocaleString() || '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {title.title_distribution_settings?.[0]?.company_percentage || 50}% / {title.title_distribution_settings?.[0]?.filmmaker_percentage || 50}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleEditTitle(title)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDeleteTitle(title.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Titles Summary */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Recent Titles Summary</h3>
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

      {/* Payment Request Management Modal */}
      {showManageRequestModal && currentRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Manage Payment Request</h3>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Filmmaker</p>
                <p className="font-medium">
                  {currentRequest.filmmaker?.first_name && currentRequest.filmmaker?.last_name 
                    ? `${currentRequest.filmmaker.first_name} ${currentRequest.filmmaker.last_name}`
                    : currentRequest.filmmaker?.email
                  }
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Amount Requested</p>
                <p className="font-medium">${currentRequest.amount_requested.toLocaleString()}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Current Status</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  currentRequest.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  currentRequest.status === 'approved' ? 'bg-green-100 text-green-800' :
                  currentRequest.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {currentRequest.status}
                </span>
              </div>

              {(currentRequest.status === 'pending' || currentRequest.status === 'approved') && (
                <Input
                  type="number"
                  step="0.01"
                  label="Amount to Approve"
                  value={modalAmountApproved}
                  onChange={(e) => setModalAmountApproved(e.target.value)}
                  placeholder="0.00"
                />
              )}

              {currentRequest.status === 'approved' && (
                <>
                  <Input
                    label="Payment Method"
                    value={modalPaymentMethod}
                    onChange={(e) => setModalPaymentMethod(e.target.value)}
                    placeholder="e.g., PayPal, Venmo, Check"
                  />
                  
                  <Input
                    type="date"
                    label="Payment Date"
                    value={modalPaymentDate}
                    onChange={(e) => setModalPaymentDate(e.target.value)}
                  />
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Notes
                </label>
                <textarea
                  value={modalAdminNotes}
                  onChange={(e) => setModalAdminNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Optional notes about this request"
                />
              </div>

              <div className="flex space-x-2 pt-4">
                {currentRequest.status === 'pending' && (
                  <>
                    <Button
                      onClick={() => handleUpdateRequestStatus('approved')}
                      className="flex-1"
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => handleUpdateRequestStatus('rejected')}
                      className="flex-1"
                    >
                      Reject
                    </Button>
                  </>
                )}
                
                {currentRequest.status === 'approved' && (
                  <Button
                    onClick={() => handleUpdateRequestStatus('paid')}
                    className="flex-1"
                  >
                    Mark as Paid
                  </Button>
                )}
                
                <Button
                  variant="secondary"
                  onClick={handleCloseManageRequestModal}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}