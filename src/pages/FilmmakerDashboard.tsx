import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Film, DollarSign, Clock, TrendingUp, Plus, BarChart3, User, Settings, LogOut } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { supabase, Content, PaymentRequest, FilmmakerBalance, StreamingPayment } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { FinancialDashboard } from '../components/FinancialDashboard';
import { FilmmakerPaymentHistory } from '../components/FilmmakerPaymentHistory';
import { TitleCards } from '../components/TitleCards';

interface FilmmakerStats {
  totalTitles: number;
  totalEarned: number;
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
    totalPaid: 0,
    availableBalance: 0,
  });
  const [titles, setTitles] = useState<Content[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [streamingPayments, setStreamingPayments] = useState<StreamingPayment[]>([]);
  const [balance, setBalance] = useState<FilmmakerBalance | null>(null);
  const [loading, setLoading] = useState(true);

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
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    if (!profile?.id) {
      console.log('No profile ID available');
      setLoading(false);
      return;
    }

    try {
      console.log('=== FILMMAKER DASHBOARD DATA FETCH ===');
      console.log('Fetching data for filmmaker ID:', profile.id);
      console.log('Profile email:', profile.email);
      
      // Fetch filmmaker's titles with detailed logging
      console.log('Step 1: Fetching titles...');
      const { data: titlesData, error: titlesError } = await supabase
        .from('content')
        .select('*')
        .or(`filmmaker_id.eq.${profile.id},owner_id.eq.${profile.id},owner_email.eq.${profile.email}`)
        .order('created_at', { ascending: false });

      console.log('Titles query result:', { 
        titlesData, 
        titlesError,
        count: titlesData?.length || 0 
      });

      if (titlesError) {
        console.error('Error fetching titles:', titlesError);
        throw titlesError;
      }
      
      const filmmakertitles = titlesData || [];
      setTitles(filmmakertitles);
      console.log('✅ Titles set:', filmmakertitles.length);

      // If no titles found, check if filmmaker exists in other ways
      if (filmmakertitles.length === 0) {
        console.log('⚠️ No titles found for filmmaker. Checking alternative queries...');
        
        // Check if there are any titles with this email as owner
        const { data: emailTitles, error: emailError } = await supabase
          .from('content')
          .select('*')
          .eq('owner_email', profile.email);
        
        console.log('Email-based titles:', { emailTitles, emailError });
        
        // Check all titles to see what's available
        const { data: allTitles, error: allError } = await supabase
          .from('content')
          .select('*')
          .limit(5);
        
        console.log('Sample of all titles:', { allTitles, allError });
      }

      // Fetch filmmaker's balance
      console.log('Step 2: Fetching balance...');
      const { data: balanceData, error: balanceError } = await supabase
        .from('filmmaker_balances')
        .select('*')
        .eq('filmmaker_id', profile.id);

      console.log('Balance query result:', { balanceData, balanceError });
      if (balanceError) {
        console.error('Error fetching balance:', balanceError);
      }
      
      // Handle the case where no balance record exists yet
      const balance = balanceData && balanceData.length > 0 ? balanceData[0] : null;
      setBalance(balance);

      // Fetch payments from the payments table for this filmmaker
      // Get payments by content_id matching the filmmaker's titles
      console.log('Step 3: Fetching payments from payments table...');

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

      console.log('Payments table query result:', {
        paymentsTableData,
        paymentsTableError,
        count: paymentsTableData?.length || 0
      });

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

      // Process historical data from titles
      console.log('Step 4: Processing historical data...');
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

      console.log('Historical payments processed:', historicalPayments.length);

      // Combine streaming payments with historical data
      const allPayments = [...streamingPaymentsData, ...historicalPayments];
      setStreamingPayments(allPayments);
      console.log('✅ Total payments (streaming + historical):', allPayments.length);

      // Calculate totals including historical data
      console.log('Step 5: Calculating totals...');
      const currentEarned = balanceData?.total_earned || 0;
      const currentPaid = balanceData?.total_paid || 0;
      
      // Add historical totals from content table
      const historicalTotals = filmmakertitles.reduce((acc, content) => ({
        historicalEarned: acc.historicalEarned + (content.previous_gross_amount || 0),
        historicalPaid: acc.historicalPaid + (content.previous_amount_paid || 0),
        historicalNet: acc.historicalNet + (content.previous_net_revenue || 0)
      }), { historicalEarned: 0, historicalPaid: 0, historicalNet: 0 });

      console.log('Historical totals calculated:', historicalTotals);

      // Calculate streaming payment totals
      const streamingTotals = streamingPaymentsData.reduce((acc, payment) => ({
        streamingEarned: acc.streamingEarned + (payment.gross_amount || 0),
        streamingNet: acc.streamingNet + (payment.net_amount || 0)
      }), { streamingEarned: 0, streamingNet: 0 });

      console.log('Streaming totals calculated:', streamingTotals);

      // Fetch payment requests
      console.log('Step 6: Fetching payment requests...');
      const { data: requestsData, error: requestsError } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('filmmaker_id', profile.id)
        .order('requested_at', { ascending: false });

      console.log('Payment requests query result:', { 
        requestsData, 
        requestsError,
        count: requestsData?.length || 0 
      });
      
      if (requestsError) {
        console.error('Error fetching payment requests:', requestsError);
      }
      setPaymentRequests(requestsData || []);

      // Calculate final stats
      const totalEarnedWithHistory = currentEarned + historicalTotals.historicalEarned + streamingTotals.streamingEarned;
      const totalPaidWithHistory = currentPaid + historicalTotals.historicalPaid;
      
      // Calculate available balance as the difference between net income and total paid
      const totalNetIncome = historicalTotals.historicalNet + streamingTotals.streamingNet;
      const availableBalance = Math.max(0, totalNetIncome - totalPaidWithHistory);

      const finalStats = {
        totalTitles: filmmakertitles.length,
        totalEarned: totalEarnedWithHistory,
        totalPaid: totalPaidWithHistory,
        availableBalance: availableBalance,
      };
      
      console.log('✅ Final filmmaker stats calculated:', finalStats);
      setStats(finalStats);

      console.log('=== FILMMAKER DASHBOARD DATA FETCH COMPLETE ===');

    } catch (error) {
      console.error('❌ Error fetching filmmaker dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayment = async () => {
    const amount = parseFloat(requestAmount);
    const maxAmount = Math.round(stats.availableBalance * 100) / 100;
    const requestedAmount = Math.round(amount * 100) / 100;

    if (!profile?.id || isNaN(amount) || requestedAmount < 100 || requestedAmount > maxAmount) {
      alert(`Please enter a valid amount between $100 and $${maxAmount.toFixed(2)}`);
      return;
    }

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
      alert('Payment request submitted successfully! Expect payment within 14 days from time of request.');
    } catch (error) {
      console.error('Error requesting payment:', error);
      alert('Error submitting payment request. Please try again.');
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
        <p className="ml-4 text-gray-600">Loading filmmaker data...</p>
      </div>
    );
  }

  // Create chart data with both streaming payments and historical data
  const chartData = streamingPayments
    .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
    .slice(0, 8)
    .map(payment => ({
      title: payment.content.title_name.substring(0, 15) + (payment.content.title_name.length > 15 ? '...' : ''),
      gross: payment.gross_amount || 0,
      net: payment.net_amount || 0,
      date: payment.payment_date,
      platform: payment.platform
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Filmmaker Dashboard</h1>
        <div className="flex items-center space-x-4">
          {/* Profile and Sign Out Buttons */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowProfileModal(true)}
            className="flex items-center space-x-2"
          >
            <Settings className="h-4 w-4" />
            <span>Edit Profile</span>
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSignOut}
            className="flex items-center space-x-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </Button>
          
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
              onClick={() => setActiveTab('titles')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'titles'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              My Titles
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
          
          <div className="text-sm text-gray-500">
            Welcome back, {profile?.first_name || 'Filmmaker'}!
          </div>
        </div>
      </div>

      {/* Render content based on active tab */}
      {activeTab === 'financial' ? (
        <div className="space-y-6">
          <FinancialDashboard userId={profile?.id} userRole="filmmaker" />
          {profile?.id && <FilmmakerPaymentHistory filmmakerI={profile.id} />}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <Card>
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
                    disabled={stats.availableBalance < 100}
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
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Title
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Platform
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Gross Revenue
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Your Share
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {streamingPayments.map((payment: any) => (
                        <tr key={payment.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {payment.content.title_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              payment.platform === 'Historical Data' 
                                ? 'bg-purple-100 text-purple-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {payment.platform}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(payment.payment_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ${payment.gross_amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ${payment.net_amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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