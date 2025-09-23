import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Film, DollarSign, Clock, TrendingUp, Plus, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, Content, PaymentRequest, FilmmakerBalance, StreamingPayment } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { FinancialDashboard } from '../components/FinancialDashboard';

interface FilmmakerStats {
  totalTitles: number;
  totalEarned: number;
  totalPaid: number;
  availableBalance: number;
}

export function FilmmakerDashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'financial'>('overview');
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
        .eq('filmmaker_id', profile.id)
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
        .eq('filmmaker_id', profile.id)
        .single();

      console.log('Balance query result:', { balanceData, balanceError });
      if (balanceError && balanceError.code !== 'PGRST116') {
        console.error('Error fetching balance:', balanceError);
      }
      setBalance(balanceData);

      // Fetch streaming payments for filmmaker's titles
      console.log('Step 3: Fetching streaming payments...');
      const titleIds = filmmakertitles.map(title => title.id);
      let streamingPaymentsData: any[] = [];
      
      if (titleIds.length > 0) {
        console.log('Fetching payments for title IDs:', titleIds);
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('streaming_payments')
          .select(`
            *,
            content!inner(title_name, filmmaker_id)
          `)
          .in('title_id', titleIds)
          .order('payment_date', { ascending: false });

        console.log('Streaming payments query result:', { 
          paymentsData, 
          paymentsError,
          count: paymentsData?.length || 0 
        });
        
        if (paymentsError) {
          console.error('Error fetching streaming payments:', paymentsError);
        } else {
          streamingPaymentsData = paymentsData || [];
        }
      } else {
        console.log('No title IDs to fetch payments for');
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
      const availableBalance = balanceData?.available_balance || 0;

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
    if (!profile?.id || !balance || balance.available_balance < 100) return;

    try {
      const { error } = await supabase
        .from('payment_requests')
        .insert({
          filmmaker_id: profile.id,
          content_id: titles[0]?.id,
          amount_requested: balance.available_balance,
        });

      if (error) throw error;

      fetchDashboardData();
      alert('Payment request submitted successfully!');
    } catch (error) {
      console.error('Error requesting payment:', error);
      alert('Error submitting payment request. Please try again.');
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
          
          <div className="text-sm text-gray-500">
            Welcome back, {profile?.first_name || 'Filmmaker'}!
          </div>
        </div>
      </div>

      {/* Render content based on active tab */}
      {activeTab === 'financial' ? (
        <FinancialDashboard userId={profile?.id} userRole="filmmaker" />
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

                  {stats.availableBalance >= 100 ? (
                    <Button
                      onClick={handleRequestPayment}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Request Payment
                    </Button>
                  ) : (
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
    </div>
  );
}