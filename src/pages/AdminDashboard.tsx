import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

interface FinancialData {
  month: string;
  revenue: number;
  expenses: number;
  net: number;
}

interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
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
  previous_gross_amount: string;
  previous_expenses: string;
  previous_distribution_fee: string;
  previous_net_revenue: string;
  previous_amount_paid: string;
  previous_balance_due: string;
  distribution_percentage: string;
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
  const [allContent, setAllContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Financial performance state
  const [financialData, setFinancialData] = useState<FinancialData[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary>({
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
  });
  const [selectedTitleForFinancials, setSelectedTitleForFinancials] = useState<string>('');
  
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
    previous_gross_amount: '',
    previous_expenses: '',
    previous_distribution_fee: '',
    previous_net_revenue: '',
    previous_amount_paid: '',
    previous_balance_due: '',
    distribution_percentage: '20',
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
      console.log('Admin Dashboard: Fetching all data...');
      
      await Promise.all([
        fetchTitles(),
        fetchFilmmakers(),
        fetchPaymentRequests(),
        fetchStreamingPayments(),
        fetchFinancialData(),
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
    
    console.log('🎬 Fetching filmmakers from users table...');
    
    try {
      // Direct query to fetch all users
      const { data: allUsers, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, role, created_at')
        .order('created_at', { ascending: false });
      
      console.log('📊 Raw users data from database:', allUsers);
      console.log('❌ Database error (if any):', error);
      
      if (error) {
        console.error('💥 Failed to fetch users:', error);
        setFilmmakers([]);
        return;
      }
      
      if (!allUsers || !Array.isArray(allUsers)) {
        console.error('❌ Invalid data format received:', allUsers);
        setFilmmakers([]);
        return;
      }
      
      console.log('📈 Total users found:', allUsers.length);
      
      // Log all users with their roles
      console.log('👥 All users in database:');
      allUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.first_name || 'No first name'} ${user.last_name || 'No last name'} (${user.email}) - Role: "${user.role}" - ID: ${user.id}`);
      });
      
      // Filter users where role = 'filmmaker' in JavaScript
      const filmmakers = allUsers.filter(user => {
        const isFilmmaker = user.role === 'filmmaker';
        console.log(`🎭 Checking user ${user.email}: role="${user.role}" -> isFilmmaker=${isFilmmaker}`);
        return isFilmmaker;
      });
      
      console.log('🎬 Filtered filmmakers (role = "filmmaker"):', filmmakers);
      console.log('📊 Number of filmmakers found:', filmmakers.length);
      
      if (filmmakers.length > 0) {
        console.log('✅ Filmmaker details:');
        filmmakers.forEach((filmmaker, index) => {
          console.log(`  ${index + 1}. ${filmmaker.first_name || 'No name'} ${filmmaker.last_name || ''} (${filmmaker.email}) - ID: ${filmmaker.id}`);
        });
      } else {
        console.log('⚠️ No filmmakers found after filtering');
        console.log('🔍 This could mean:');
        console.log('   - No users have role="filmmaker" (check database)');
        console.log('   - RLS policies are blocking access');
        console.log('   - The role field contains different values');
      }
      
      // Set the filmmakers in state to populate dropdown
      setFilmmakers(filmmakers);
      console.log('✅ Filmmakers state updated successfully');
      
    } catch (error) {
      console.error('💥 Unexpected error fetching filmmakers:', error);
      console.error('🔍 Error stack:', error.stack);
      setFilmmakers([]);
    }
  };

  const fetchPaymentRequests = async () => {
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select(`
          *,
          filmmaker:filmmaker_id (
            id,
            email,
            first_name,
            last_name
          )
        `)
        .order('requested_at', { ascending: false });

      if (error) {
        console.error('Error fetching payment requests:', error);
        return;
      }
      
      setPaymentRequests(data || []);
    } catch (error) {
      console.error('Unexpected error fetching payment requests:', error);
      setPaymentRequests([]);
    }
  };

  const fetchStreamingPayments = async () => {
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('streaming_payments')
        .select(`
          *,
          content:title_id (
            id,
            title_name
          )
        `)
        .order('payment_date', { ascending: false });

      if (error) {
        console.error('Error fetching streaming payments:', error);
        return;
      }
      
      setStreamingPayments(data || []);
    } catch (error) {
      console.error('Unexpected error fetching streaming payments:', error);
      setStreamingPayments([]);
    }
  };

  const fetchFinancialData = async () => {
    if (!supabase) return;
    
    try {
      // Fetch all content with historical data
      const { data: allContent, error: contentError } = await supabase
        .from('content')
        .select('*')
        .order('created_at', { ascending: true });

      if (contentError) {
        console.error('Error fetching content for financial data:', contentError);
        return;
      }

      // Fetch streaming payments with content info
      const { data: streamingPayments, error: paymentsError } = await supabase
        .from('streaming_payments')
        .select(`
          *,
          content:title_id (
            id,
            title_name,
            expenses_total
          )
        `)
        .order('payment_date', { ascending: true });

      if (paymentsError) {
        console.error('Error fetching streaming payments:', paymentsError);
        return;
      }

      // Process data by month
      const monthlyData: { [key: string]: { revenue: number; expenses: number } } = {};
      let totalRevenue = 0;
      let totalExpenses = 0;

      // Process historical data from content table
      allContent?.forEach((content: any) => {
        // Filter by selected title if one is chosen
        if (selectedTitleForFinancials && content.id !== selectedTitleForFinancials) {
          return;
        }

        // Add historical data if it exists
        if (content.previous_gross_amount > 0 || content.previous_expenses > 0) {
          // Use creation date for historical data or a default historical month
          const date = new Date(content.created_at);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { revenue: 0, expenses: 0 };
          }
          
          const historicalRevenue = content.previous_gross_amount || 0;
          const historicalExpenses = content.previous_expenses || 0;
          
          monthlyData[monthKey].revenue += historicalRevenue;
          monthlyData[monthKey].expenses += historicalExpenses;
          
          totalRevenue += historicalRevenue;
          totalExpenses += historicalExpenses;
        }

        // Add current expenses from content table
        if (content.expenses_total > 0) {
          const date = new Date(content.updated_at || content.created_at);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { revenue: 0, expenses: 0 };
          }
          
          monthlyData[monthKey].expenses += content.expenses_total;
          totalExpenses += content.expenses_total;
        }
      });

      // Process streaming payments
      streamingPayments?.forEach((payment: any) => {
        // Filter by selected title if one is chosen
        if (selectedTitleForFinancials && payment.title_id !== selectedTitleForFinancials) {
          return;
        }

        const date = new Date(payment.payment_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { revenue: 0, expenses: 0 };
        }
        
        const revenue = payment.gross_amount || 0;
        monthlyData[monthKey].revenue += revenue;
        totalRevenue += revenue;
      });

      // Convert to array and sort by month
      const chartData: FinancialData[] = Object.entries(monthlyData)
        .map(([month, data]) => ({
          month: new Date(month + '-01').toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short' 
          }),
          revenue: data.revenue,
          expenses: data.expenses,
          net: data.revenue - data.expenses,
        }))
        .sort((a, b) => new Date(a.month + ' 1').getTime() - new Date(b.month + ' 1').getTime());

      setFinancialData(chartData);
      setFinancialSummary({
        totalRevenue,
        totalExpenses,
        netIncome: totalRevenue - totalExpenses,
      });
    } catch (error) {
      console.error('Unexpected error fetching financial data:', error);
    }
  };

  // Refetch financial data when title filter changes
  useEffect(() => {
    if (!loading) {
      fetchFinancialData();
    }
  }, [selectedTitleForFinancials]);

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

  // Recalculate stats whenever data changes
  useEffect(() => {
    calculateStats();
  }, [filmmakers, titles, streamingPayments]);



  const handleAddTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    try {
      const { data: insertedTitle, error } = await supabase
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
          previous_gross_amount: newTitle.previous_gross_amount ? parseFloat(newTitle.previous_gross_amount) : 0,
          previous_expenses: newTitle.previous_expenses ? parseFloat(newTitle.previous_expenses) : 0,
          previous_distribution_fee: newTitle.previous_distribution_fee ? parseFloat(newTitle.previous_distribution_fee) : 0,
          previous_net_revenue: newTitle.previous_net_revenue ? parseFloat(newTitle.previous_net_revenue) : 0,
          previous_amount_paid: newTitle.previous_amount_paid ? parseFloat(newTitle.previous_amount_paid) : 0,
          previous_balance_due: newTitle.previous_balance_due ? parseFloat(newTitle.previous_balance_due) : 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Create distribution settings for the title
      if (insertedTitle) {
        const companyPercentage = parseFloat(newTitle.distribution_percentage);
        const filmmakerPercentage = 100 - companyPercentage;
        
        const { error: distributionError } = await supabase
          .from('title_distribution_settings')
          .insert({
            title_id: insertedTitle.id,
            company_percentage: companyPercentage,
            filmmaker_percentage: filmmakerPercentage,
          });

        if (distributionError) {
          console.error('Error creating distribution settings:', distributionError);
          // Don't throw here as the title was created successfully
        }
      }

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
        previous_gross_amount: '',
        previous_expenses: '',
        previous_distribution_fee: '',
        previous_net_revenue: '',
        previous_amount_paid: '',
        previous_balance_due: '',
        distribution_percentage: '20',
      });
      setShowAddTitle(false);
      fetchDashboardData();
      alert('Title added successfully!');
    } catch (error) {
      console.error('Error adding title:', error);
      alert('Error adding title. Please try again.');
    }
  };

  const handleOpenAddTitle = () => {
    console.log('Opening Add Title modal, fetching filmmakers...');
    setShowAddTitle(true);
    fetchFilmmakers(); // Fetch filmmakers when modal opens
  };

  const handleAddFilmmaker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    try {
      // Check if user already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id, email, role, first_name, last_name')
        .eq('email', newFilmmaker.email)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw new Error('Error checking existing user');
      }

      if (existingUser) {
        alert(`User already exists!\n\nEmail: ${existingUser.email}\nName: ${existingUser.first_name || ''} ${existingUser.last_name || ''}\nRole: ${existingUser.role}\n\nYou cannot create a duplicate user.`);
        return;
      }

      // Generate a temporary password
      const tempPassword = 'TempPass123!';

      // Create the auth user first
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newFilmmaker.email,
        password: tempPassword,
        options: {
          data: {
            first_name: newFilmmaker.first_name,
            last_name: newFilmmaker.last_name,
            role: 'filmmaker'
          }
        }
      });

      if (authError) {
        throw new Error(`Failed to create auth user: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('No user returned from auth creation');
      }

      // The user profile should be automatically created by the trigger
      // Wait a moment for the trigger to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify the user was created in the users table
      const { data: createdUser, error: verifyError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();
      console.log('Users query result:', { usersData, usersError });

      if (verifyError) {
        console.error('User profile not found after creation:', verifyError);
        // Try to create the profile manually
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: newFilmmaker.email,
            first_name: newFilmmaker.first_name,
            last_name: newFilmmaker.last_name,
            role: 'filmmaker'
          });

        if (insertError) {
          throw new Error(`Failed to create user profile: ${insertError.message}`);
        }
      }

      // Reset form and refresh data
      setNewFilmmaker({
        email: '',
        first_name: '',
        last_name: '',
      });
      setShowAddFilmmaker(false);
      fetchDashboardData();
      alert(`Filmmaker created successfully!\n\nEmail: ${newFilmmaker.email}\nTemporary password: ${tempPassword}\n\nPlease share these credentials with the filmmaker.`);
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
      console.log('Payment requests query result:', { requestsData, requestsError });

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
      console.log('Streaming payments query result:', { paymentsData, paymentsError });
      });
      setShowAddPayment(false);
      fetchDashboardData();
  const handleApproveTitle = async (titleId: string) => {
      const historicalPayments = allTitles

    try {
      const { error } = await supabase
        .from('content')
        .update({ status: 'approved' })
        .eq('id', titleId);

      if (error) throw error;

      fetchDashboardData();
      console.log('Historical payments processed:', historicalPayments);

      alert('Title approved successfully!');
    } catch (error) {
      console.error('Error approving title:', error);
      alert('Error approving title. Please try again.');
    }
  };

  const handleRejectTitle = async (titleId: string) => {
    if (!supabase) return;

      console.log('Current payments processed:', currentPayments);

    try {
      const { error } = await supabase
        .from('content')
        .update({ status: 'rejected' })
      const expenseEntries = allTitles

      if (error) throw error;

      fetchDashboardData();
      alert('Title rejected successfully!');
    } catch (error) {
      console.error('Error rejecting title:', error);
      alert('Error rejecting title. Please try again.');
    }
  };

      console.log('Complete financial data:', completeFinancialData);
      console.log('Content query result:', { contentData, contentError });
  const handleApprovePayment = async (requestId: string, approvedAmount: number) => {
      const allTitles = contentData || [];
      setTitles(allTitles);
      const totalUsers = (usersData || []).length;
      const totalTitles = allTitles.length;
    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({ 
      console.log('Summary stats calculated:', {
        totalUsers,
        totalTitles,
        pendingRequests,
        totalRevenue,
        totalExpenses
      });

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
          <Button onClick={handleOpenAddTitle}>
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
        {/* Financial Performance Section */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Financial Performance
                </h3>
                <div className="flex items-center space-x-4">
                  <select
                    value={selectedTitleForFinancials}
                    onChange={(e) => setSelectedTitleForFinancials(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Titles</option>
                    {titles.map((title) => (
                      <option key={title.id} value={title.id}>
                        {title.title_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Financial Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-green-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-900">
                    ${financialSummary.totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-red-600">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-900">
                    ${financialSummary.totalExpenses.toLocaleString()}
                  </p>
                </div>
                <div className={`p-4 rounded-lg ${
                  financialSummary.netIncome >= 0 ? 'bg-blue-50' : 'bg-orange-50'
                }`}>
                  <p className={`text-sm font-medium ${
                    financialSummary.netIncome >= 0 ? 'text-blue-600' : 'text-orange-600'
                  }`}>
                    Net Income
                  </p>
                  <p className={`text-2xl font-bold ${
                    financialSummary.netIncome >= 0 ? 'text-blue-900' : 'text-orange-900'
                  }`}>
                    ${financialSummary.netIncome.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {financialData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value, name) => [
                          `$${Number(value).toLocaleString()}`, 
                          name === 'revenue' ? 'Revenue' : 
                          name === 'expenses' ? 'Expenses' : 'Net Income'
                        ]}
                        labelFormatter={(label) => `Month: ${label}`}
                      />
                      <Bar dataKey="revenue" fill="#10B981" name="revenue" />
                      <Bar dataKey="expenses" fill="#EF4444" name="expenses" />
                      <Bar dataKey="net" fill="#3B82F6" name="net" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No financial data available</p>
                    <p className="text-sm">
                      {selectedTitleForFinancials 
                        ? 'No payments found for selected title' 
                        : 'Add payments to see financial performance'
                      }
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
          <div className="w-full max-w-md max-h-[90vh] bg-white rounded-lg shadow-lg flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold">Add New Title</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
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
                    <option value="">
                      {loading ? 'Loading filmmakers...' : 'Select a filmmaker'}
                    </option>
                    {filmmakers.length > 0 ? (
                      filmmakers.map((filmmaker) => (
                        <option key={filmmaker.id} value={filmmaker.id}>
                          {filmmaker.first_name && filmmaker.last_name 
                            ? `${filmmaker.first_name} ${filmmaker.last_name} (${filmmaker.email})`
                            : filmmaker.email
                          }
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>
                        {loading ? 'Loading...' : 'No filmmakers found'}
                      </option>
                    )}
                  </select>
                  {filmmakers.length === 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      No filmmakers found in the users table. Please create a filmmaker first.
                    </p>
                  )}
                  {filmmakers.length > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      Found {filmmakers.length} filmmaker{filmmakers.length !== 1 ? 's' : ''} in the database
                    </p>
                  )}
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

                <div className="border-t pt-4 mt-4">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Historical Accounting Data</h4>
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

                <div className="border-t pt-4 mt-4">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Distribution Settings</h4>
                  <Input
                    label="Our Distribution Percentage (%)"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={newTitle.distribution_percentage}
                    onChange={(e) => setNewTitle({ ...newTitle, distribution_percentage: e.target.value })}
                    placeholder="20"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    This percentage determines how much of any payment goes to the company vs. the filmmaker.
                    For example, with 20%, if we receive $100, the filmmaker gets $80.
                  </p>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <div className="flex space-x-2">
                <Button 
                  onClick={handleAddTitle} 
                  className="flex-1"
                  disabled={!newTitle.title_name || !newTitle.filmmaker_id}
                >
                  Add Title
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAddTitle(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>

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