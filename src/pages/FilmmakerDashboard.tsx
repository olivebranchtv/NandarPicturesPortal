import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Film, DollarSign, Clock, TrendingUp, Plus, BarChart3, User, Settings, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { supabase, Content, PaymentRequest, FilmmakerBalance, StreamingPayment } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { FinancialDashboard } from '../components/FinancialDashboard';
import { FilmmakerPaymentHistory } from '../components/FilmmakerPaymentHistory';
import { TitleCards } from '../components/TitleCards';
import { RoyaltyStatement } from '../components/RoyaltyStatement';

interface FilmmakerStats {
  totalTitles: number;
  totalEarned: number;
  totalExpenses: number;
  totalPaid: number;
  availableBalance: number;
}

export function FilmmakerDashboard() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'titles' | 'financial'>('overview');
  const [showRequestPayment, setShowRequestPayment] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    paypal_email: '',
    venmo_username: '',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [stats, setStats] = useState<FilmmakerStats>({
    totalTitles: 0,
    totalEarned: 0,
    totalExpenses: 0,
    totalPaid: 0,
    availableBalance: 0,
  });
  const [titles, setTitles] = useState<Content[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [streamingPayments, setStreamingPayments] = useState<StreamingPayment[]>([]);
  const [balance, setBalance] = useState<FilmmakerBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingPayment, setRequestingPayment] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      fetchDashboardData();
      setProfileFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        address: profile.address || '',
        city: profile.city || '',
        state: profile.state || '',
        zip_code: profile.zip_code || '',
        paypal_email: profile.paypal_email || '',
        venmo_username: profile.venmo_username || '',
      });

      if (!supabase) return;

      const subscription = supabase
        .channel('payment_requests_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payment_requests',
            filter: `filmmaker_id=eq.${profile.id}`
          },
          () => fetchDashboardData()
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    if (!profile?.id || !supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data: titlesData, error: titlesError } = await supabase
        .from('content')
        .select('*')
        .or(`filmmaker_id.eq.${profile.id},owner_id.eq.${profile.id},owner_email.eq.${profile.email}`)
        .order('created_at', { ascending: false });

      if (titlesError) throw titlesError;

      const filmmakertitles = titlesData || [];
      setTitles(filmmakertitles);

      const { data: balanceData, error: balanceError } = await supabase
        .from('filmmaker_balances')
        .select('*')
        .eq('filmmaker_id', profile.id);

      if (balanceError) console.error('Error fetching balance:', balanceError);

      const balance = balanceData && balanceData.length > 0 ? balanceData[0] : null;
      setBalance(balance);

      const titleIds = filmmakertitles.map(t => t.id);
      let paymentsTableData: any[] = [];
      let paymentsTableError = null;

      if (titleIds.length > 0) {
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('payments')
            .select(`
              *,
              content(title_name)
            `)
            .in('content_id', titleIds)
            .order('payment_date', { ascending: false })
            .range(from, from + batchSize - 1);

          if (error) {
            paymentsTableError = error;
            break;
          }

          if (data && data.length > 0) {
            paymentsTableData = [...paymentsTableData, ...data];
            from += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }
      }

      let streamingPaymentsData: any[] = [];

      if (paymentsTableError) {
        console.error('Error fetching payments:', paymentsTableError);
      } else {
        // Transform payments table data to match streaming_payments format
        streamingPaymentsData = (paymentsTableData || []).map(payment => ({
          id: payment.id,
          title_id: payment.content_id,
          platform: payment.channel || 'Payment',
          outlet: null,
          payment_date: payment.payment_date,
          gross_amount: payment.gross_amount || 0,
          net_amount: payment.net_amount || 0,
          distribution_percentage: payment.distribution_fee || 0,
          notes: payment.notes,
          created_at: payment.created_at,
          updated_at: payment.updated_at,
          content: {
            title_name: payment.content?.title_name || payment.title_name || 'Unknown',
            filmmaker_id: payment.filmmaker_id
          }
        }));
      }

      const historicalPayments = filmmakertitles
        .filter(content => 
          (content.previous_gross_amount && content.previous_gross_amount > 0) || 
          (content.previous_net_revenue && content.previous_net_revenue > 0)
        )
        .map(content => ({
          id: `historical-${content.id}`,
          title_id: content.id,
          platform: 'Historical Data',
          outlet: null,
          payment_date: content.created_at.split('T')[0],
          gross_amount: content.previous_gross_amount || 0,
          net_amount: content.previous_net_revenue || 0,
          distribution_percentage: 50,
          notes: 'Historical revenue data from previous system',
          created_at: content.created_at,
          updated_at: content.updated_at,
          content: {
            title_name: content.title_name,
            filmmaker_id: content.filmmaker_id
          }
        }));

      const allPayments = [...streamingPaymentsData, ...historicalPayments];
      setStreamingPayments(allPayments);

      const currentEarned = balanceData?.total_earned || 0;
      const currentPaid = balanceData?.total_paid || 0;
      
      // Add historical totals from content table
      const historicalTotals = filmmakertitles.reduce((acc, content) => {
        const grossAmount = content.previous_gross_amount || 0;
        const netRevenue = content.previous_net_revenue || 0;
        const expenses = grossAmount > 0 ? (grossAmount - netRevenue) : 0;

        return {
          historicalEarned: acc.historicalEarned + grossAmount,
          historicalPaid: acc.historicalPaid + (content.previous_amount_paid || 0),
          historicalNet: acc.historicalNet + netRevenue,
          historicalExpenses: acc.historicalExpenses + expenses
        };
      }, { historicalEarned: 0, historicalPaid: 0, historicalNet: 0, historicalExpenses: 0 });

      const streamingTotals = streamingPaymentsData.reduce((acc, payment) => {
        const grossAmount = payment.gross_amount || 0;
        const netAmount = payment.net_amount || 0;
        const expenses = grossAmount > 0 ? (grossAmount - netAmount) : 0;

        return {
          streamingEarned: acc.streamingEarned + (grossAmount > 0 ? grossAmount : 0),
          streamingNet: acc.streamingNet + netAmount, // Include both positive and negative
          streamingPaid: acc.streamingPaid + (netAmount < 0 ? Math.abs(netAmount) : 0),
          streamingExpenses: acc.streamingExpenses + expenses
        };
      }, { streamingEarned: 0, streamingNet: 0, streamingPaid: 0, streamingExpenses: 0 });

      const { data: requestsData, error: requestsError } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('filmmaker_id', profile.id)
        .order('requested_at', { ascending: false });

      if (requestsError) console.error('Error fetching payment requests:', requestsError);
      setPaymentRequests(requestsData || []);

      // Calculate final stats
      // For display purposes: show total earned including historical
      const totalEarnedWithHistory = currentEarned + historicalTotals.historicalEarned + streamingTotals.streamingEarned;
      const totalPaidWithHistory = historicalTotals.historicalPaid + streamingTotals.streamingPaid;
      const totalExpenses = historicalTotals.historicalExpenses + streamingTotals.streamingExpenses;

      // IMPORTANT: Available balance should ONLY come from payments table
      // Historical data is already settled (previous_balance_due = 0)
      // streamingNet already includes both positive revenue and negative withdrawals
      const availableBalance = Math.max(0, streamingTotals.streamingNet);

      const finalStats = {
        totalTitles: filmmakertitles.length,
        totalEarned: totalEarnedWithHistory,
        totalExpenses: totalExpenses,
        totalPaid: totalPaidWithHistory,
        availableBalance: availableBalance,
      };
      
      setStats(finalStats);

    } catch (error) {
      console.error('Error fetching filmmaker dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayment = async () => {
    const amount = parseFloat(requestAmount);
    const maxAmount = Math.round(stats.availableBalance * 100) / 100;
    const requestedAmount = Math.round(amount * 100) / 100;

    if (!profile?.id || isNaN(amount) || requestedAmount < 100 || requestedAmount > maxAmount) {
      toast.error(`Please enter a valid amount between $100 and $${maxAmount.toFixed(2)}`);
      return;
    }

    const hasPendingRequest = paymentRequests.some(
      req => req.status === 'pending' || req.status === 'approved'
    );

    if (hasPendingRequest) {
      toast.error('You have a pending payment request. Please wait until it is paid before submitting another.');
      return;
    }

    setRequestingPayment(true);
    try {
      const { error } = await supabase
        .from('payment_requests')
        .insert({
          filmmaker_id: profile.id,
          content_id: titles[0]?.id,
          amount_requested: requestedAmount,
        });

      if (error) throw error;

      setShowRequestPayment(false);
      setRequestAmount('');
      fetchDashboardData();
      toast.success('Payment request submitted! Expect payment within 14 days.');
    } catch (error: any) {
      toast.error(error.message || 'Error submitting payment request. Please try again.');
    } finally {
      setRequestingPayment(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleProfileInputChange = (field: string, value: string) => {
    setProfileFormData(prev => ({ ...prev, [field]: value }));
    setProfileError('');
    setProfileSuccess('');
  };

  const handleSaveProfile = async () => {
    if (!profile?.id) return;

    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({
          first_name: profileFormData.first_name,
          last_name: profileFormData.last_name,
          address: profileFormData.address,
          city: profileFormData.city,
          state: profileFormData.state,
          zip_code: profileFormData.zip_code,
          paypal_email: profileFormData.paypal_email,
          venmo_username: profileFormData.venmo_username,
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // Update email in auth if changed
      if (profileFormData.email !== profile.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: profileFormData.email
        });

        if (emailError) {
          setProfileSuccess('Profile updated successfully! Email change requires verification - check your inbox.');
        } else {
          setProfileSuccess('Profile updated successfully!');
        }
      } else {
        setProfileSuccess('Profile updated successfully!');
      }

      // Refresh the page after a short delay to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error: any) {
      console.error('Error updating profile:', error);
      setProfileError(error.message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, color }: any) => (
    <Card>
      <CardContent className="p-3 sm:p-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${color}`}>
            <Icon className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">{title}</p>
            <p className="text-base sm:text-2xl font-bold text-gray-900 truncate">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600">Loading filmmaker data...</p>
      </div>
    );
  }

  // Create chart data with both streaming payments and historical data
  // Aggregate payments by title and include historical data
  const titleMap = new Map<string, { title: string, gross: number, net: number }>();

  // Add historical data from titles
  titles.forEach(title => {
    const previousGross = title.previous_gross_amount || 0;
    const previousNet = title.previous_net_revenue || 0;

    if (previousGross > 0 || previousNet > 0) {
      const displayTitle = title.title_name.substring(0, 15) + (title.title_name.length > 15 ? '...' : '');
      titleMap.set(title.id, {
        title: displayTitle,
        gross: previousGross,
        net: previousNet
      });
    }
  });

  // Add streaming payments data
  streamingPayments.forEach(payment => {
    const titleId = payment.title_id;
    const displayTitle = payment.content.title_name.substring(0, 15) + (payment.content.title_name.length > 15 ? '...' : '');

    if (titleMap.has(titleId)) {
      const existing = titleMap.get(titleId)!;
      existing.gross += payment.gross_amount || 0;
      existing.net += payment.net_amount || 0;
    } else {
      titleMap.set(titleId, {
        title: displayTitle,
        gross: payment.gross_amount || 0,
        net: payment.net_amount || 0
      });
    }
  });

  // Convert to array and sort by gross revenue
  const chartData = Array.from(titleMap.values())
    .filter(item => item.gross > 0 || item.net !== 0)
    .sort((a, b) => b.gross - a.gross);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header: title row + tabs row stacked */}
      <div className="space-y-3">
        {/* Row 1: title + action buttons */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 truncate">
            Filmmaker Dashboard
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-1"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Edit Profile</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center gap-1"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>

        {/* Row 2: tabs + welcome text */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('titles')}
              className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'titles'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              My Titles
            </button>
            <button
              onClick={() => setActiveTab('financial')}
              className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'financial'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Financial
            </button>
          </div>
          <div className="hidden sm:block text-sm text-gray-500 truncate">
            Welcome back, {profile?.first_name || 'Filmmaker'}!
          </div>
        </div>
      </div>

      {/* Render content based on active tab */}
      {activeTab === 'financial' ? (
        <div className="space-y-6">
          <FinancialDashboard userId={profile?.id} userRole="filmmaker" />
          {profile?.id && <FilmmakerPaymentHistory filmakerId={profile.id} />}
        </div>
      ) : activeTab === 'titles' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">My Titles</h2>
            <p className="text-sm text-gray-500">{stats.totalTitles} title{stats.totalTitles !== 1 ? 's' : ''} total</p>
          </div>
          {profile?.id && <TitleCards filmakerId={profile.id} />}
        </div>
      ) : (
        <>
          {/* Overview Tab Content - All existing functionality */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <StatCard
              icon={Film}
              title="My Titles"
              value={stats.totalTitles}
              color="bg-blue-600"
            />
            <StatCard
              icon={DollarSign}
              title="Total Earned"
              value={`$${stats.totalEarned.toLocaleString()}`}
              color="bg-green-600"
            />
            <StatCard
              icon={TrendingUp}
              title="Expenses"
              value={`$${stats.totalExpenses.toLocaleString()}`}
              color="bg-red-600"
            />
            <StatCard
              icon={TrendingUp}
              title="Total Paid"
              value={`$${stats.totalPaid.toLocaleString()}`}
              color="bg-purple-600"
            />
            <StatCard
              icon={Clock}
              title="Available Balance"
              value={`$${stats.availableBalance.toLocaleString()}`}
              color="bg-orange-600"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Chart */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <h3 className="text-lg font-semibold flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Payment History & Revenue
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
                        formatter={(value, name) => [`$${Number(value).toLocaleString()}`, name === 'gross' ? 'Gross Revenue' : 'Your Share']}
                        labelFormatter={(label) => `Title: ${label}`}
                      />
                      <Bar dataKey="gross" fill="#3B82F6" name="Gross Payment" />
                      <Bar dataKey="net" fill="#10B981" name="Your Share" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <div className="text-center">
                      <Film className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p>No revenue data available</p>
                      <p className="text-sm">Revenue and payments will appear here</p>
                      {titles.length === 0 && (
                        <p className="text-sm text-red-500 mt-2">
                          No titles found for this filmmaker account
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Royalty Statement */}
            {profile && <RoyaltyStatement filmmaker={profile} />}

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

                  <Button
                    onClick={() => setShowRequestPayment(true)}
                    className="w-full"
                    disabled={
                      stats.availableBalance < 100 ||
                      paymentRequests.some(req => req.status === 'pending' || req.status === 'approved')
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Request Payment
                  </Button>
                  {stats.availableBalance < 100 && (
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        Minimum balance of $100 required for payment requests
                      </p>
                    </div>
                  )}
                  {stats.availableBalance >= 100 && paymentRequests.some(req => req.status === 'pending' || req.status === 'approved') && (
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        You have a pending payment request. You can submit a new request once it has been paid.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Streaming Payments Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Revenue & Payment History</h3>
                <div className="text-sm text-gray-500">
                  {titles.length} title{titles.length !== 1 ? 's' : ''} • {streamingPayments.length} payment{streamingPayments.length !== 1 ? 's' : ''}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {streamingPayments.length > 0 ? (
                <>
                  {/* Mobile card list */}
                  <div className="sm:hidden space-y-3">
                    {streamingPayments.map((payment: any) => {
                      const isWithdrawal = payment.net_amount < 0;
                      return (
                        <div
                          key={payment.id}
                          className={`rounded-lg border p-3 ${isWithdrawal ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-sm font-medium text-gray-900 leading-snug">
                              {payment.content.title_name}
                            </p>
                            <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              isWithdrawal
                                ? 'bg-red-100 text-red-800'
                                : payment.platform === 'Historical Data'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {isWithdrawal ? 'Payment Out' : payment.platform}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{new Date(payment.payment_date).toLocaleDateString()}</span>
                            <div className="flex items-center gap-3">
                              <span>Gross: {isWithdrawal ? '-' : ''}${Math.abs(payment.gross_amount).toLocaleString()}</span>
                              <span className={`font-semibold ${isWithdrawal ? 'text-red-600' : 'text-green-700'}`}>
                                Net: {isWithdrawal ? '-' : ''}${Math.abs(payment.net_amount).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gross Revenue</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Your Share</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {streamingPayments.map((payment: any) => {
                          const isWithdrawal = payment.net_amount < 0;
                          return (
                            <tr key={payment.id} className={isWithdrawal ? 'bg-red-50' : ''}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {payment.content.title_name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  isWithdrawal
                                    ? 'bg-red-100 text-red-800'
                                    : payment.platform === 'Historical Data'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {isWithdrawal ? '💸 Payment Out' : payment.platform}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(payment.payment_date).toLocaleDateString()}
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm ${isWithdrawal ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                {isWithdrawal ? '-' : ''}${Math.abs(payment.gross_amount).toLocaleString()}
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm ${isWithdrawal ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                {isWithdrawal ? '-' : ''}${Math.abs(payment.net_amount).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Film className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No revenue data yet</h3>
                  <p className="text-gray-500">
                    Revenue and payment history will appear here once titles are added and payments are processed
                  </p>
                  {titles.length === 0 && (
                    <p className="text-sm text-red-500 mt-2">
                      No titles found for this filmmaker account. Contact admin to add titles.
                    </p>
                  )}
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
                    <div key={request.id} className="flex items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">
                          ${request.amount_requested.toLocaleString()}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500">
                          {new Date(request.requested_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        request.status === 'approved' ? 'bg-green-100 text-green-800' :
                        request.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {request.status}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Profile Edit Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center space-x-2">
                <User className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Edit Profile</h2>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowProfileModal(false)}
                className="flex items-center space-x-1"
              >
                <span>×</span>
              </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Personal Information */}
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-medium flex items-center">
                      <User className="h-5 w-5 mr-2" />
                      Personal Information
                    </h3>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="First Name"
                        value={profileFormData.first_name}
                        onChange={(e) => handleProfileInputChange('first_name', e.target.value)}
                        placeholder="Enter your first name"
                      />
                      <Input
                        label="Last Name"
                        value={profileFormData.last_name}
                        onChange={(e) => handleProfileInputChange('last_name', e.target.value)}
                        placeholder="Enter your last name"
                      />
                    </div>
                    <Input
                      label="Email Address"
                      type="email"
                      value={profileFormData.email}
                      onChange={(e) => handleProfileInputChange('email', e.target.value)}
                      placeholder="Enter your email address"
                    />
                    <p className="text-xs text-gray-500">
                      Changing your email will require verification
                    </p>
                  </CardContent>
                </Card>

                {/* Address Information */}
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-medium flex items-center">
                      <Film className="h-5 w-5 mr-2" />
                      Address Information
                    </h3>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input
                      label="Street Address"
                      value={profileFormData.address}
                      onChange={(e) => handleProfileInputChange('address', e.target.value)}
                      placeholder="Enter your street address"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input
                        label="City"
                        value={profileFormData.city}
                        onChange={(e) => handleProfileInputChange('city', e.target.value)}
                        placeholder="City"
                      />
                      <Input
                        label="State"
                        value={profileFormData.state}
                        onChange={(e) => handleProfileInputChange('state', e.target.value)}
                        placeholder="State"
                      />
                      <Input
                        label="ZIP Code"
                        value={profileFormData.zip_code}
                        onChange={(e) => handleProfileInputChange('zip_code', e.target.value)}
                        placeholder="ZIP"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Methods */}
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-medium flex items-center">
                      <DollarSign className="h-5 w-5 mr-2" />
                      Payment Methods
                    </h3>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input
                      label="PayPal Email"
                      type="email"
                      value={profileFormData.paypal_email}
                      onChange={(e) => handleProfileInputChange('paypal_email', e.target.value)}
                      placeholder="Enter your PayPal email"
                    />
                    <Input
                      label="Venmo Username"
                      value={profileFormData.venmo_username}
                      onChange={(e) => handleProfileInputChange('venmo_username', e.target.value)}
                      placeholder="Enter your Venmo username"
                    />
                    <p className="text-xs text-gray-500">
                      Payment methods are used for revenue distributions and payments
                    </p>
                  </CardContent>
                </Card>

                {/* Status Messages */}
                {profileError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-600">{profileError}</p>
                  </div>
                )}

                {profileSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <p className="text-sm text-green-600">{profileSuccess}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
              <Button
                variant="secondary"
                onClick={() => setShowProfileModal(false)}
                disabled={profileLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveProfile}
                disabled={profileLoading}
                className="flex items-center space-x-2"
              >
                <Settings className="h-4 w-4" />
                <span>{profileLoading ? 'Saving...' : 'Save Changes'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Request Payment Modal */}
      {showRequestPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Request Payment</h3>
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-sm">
                  <div className="mb-2">
                    <span className="font-medium">Available Balance:</span>{' '}
                    ${stats.availableBalance.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    Minimum request: $100
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {/* Payment method summary */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Payment will be sent to
                    </p>
                    <button
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      onClick={() => {
                        setShowRequestPayment(false);
                        setRequestAmount('');
                        setShowProfileModal(true);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                  {profile?.paypal_email || profile?.venmo_username || (profile as any)?.zelle_identifier ? (
                    <div className="space-y-1.5">
                      {profile?.paypal_email && (
                        <div className={`flex items-center space-x-2 rounded px-2 py-1 ${(profile as any)?.payout_method === 'paypal' ? 'bg-blue-50 ring-1 ring-blue-300' : ''}`}>
                          <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                            PayPal{(profile as any)?.payout_method === 'paypal' ? ' ★' : ''}
                          </span>
                          <span className="text-sm text-gray-800">{profile.paypal_email}</span>
                        </div>
                      )}
                      {profile?.venmo_username && (
                        <div className={`flex items-center space-x-2 rounded px-2 py-1 ${(profile as any)?.payout_method === 'venmo' ? 'bg-indigo-50 ring-1 ring-indigo-300' : ''}`}>
                          <span className="inline-flex items-center rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                            Venmo{(profile as any)?.payout_method === 'venmo' ? ' ★' : ''}
                          </span>
                          <span className="text-sm text-gray-800">@{profile.venmo_username}</span>
                        </div>
                      )}
                      {(profile as any)?.zelle_identifier && (
                        <div className={`flex items-center space-x-2 rounded px-2 py-1 ${(profile as any)?.payout_method === 'zelle' ? 'bg-purple-50 ring-1 ring-purple-300' : ''}`}>
                          <span className="inline-flex items-center rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                            Zelle{(profile as any)?.payout_method === 'zelle' ? ' ★' : ''}
                          </span>
                          <span className="text-sm text-gray-800">{(profile as any).zelle_identifier}</span>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 pt-0.5">★ = your preferred method</p>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-amber-700 font-medium">No payment method saved.</span>
                      <button
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium underline"
                        onClick={() => {
                          setShowRequestPayment(false);
                          setRequestAmount('');
                          setShowProfileModal(true);
                        }}
                      >
                        Add one now
                      </button>
                    </div>
                  )}
                </div>

                <Input
                  label="Request Amount"
                  type="number"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  placeholder="Enter amount"
                  min="100"
                  max={stats.availableBalance}
                />
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    Once approved, expect payment within 14 days from time of request.
                  </p>
                </div>
                <div className="flex space-x-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowRequestPayment(false);
                      setRequestAmount('');
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRequestPayment}
                    loading={requestingPayment}
                    className="flex-1"
                  >
                    Submit Request
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}