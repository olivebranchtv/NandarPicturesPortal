import { useState, useEffect } from 'react';
import { supabase, Content, StreamingPayment } from '../lib/supabase';

interface FinancialData {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  totalPaid: number;
  balanceDue: number;
  netProfitMargin: number;
}

interface ChartDataPoint {
  period: string;
  revenue: number;
  expenses: number;
  net: number;
  paid: number;
}

interface UseFinancialDataProps {
  userId?: string;
  userRole: 'admin' | 'filmmaker';
  selectedTitle?: string;
  dateRange: string;
}

export function useFinancialData({ userId, userRole, selectedTitle, dateRange }: UseFinancialDataProps) {
  const [financialData, setFinancialData] = useState<FinancialData>({
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    totalPaid: 0,
    balanceDue: 0,
    netProfitMargin: 0,
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [titles, setTitles] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case '3months':
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        return threeMonthsAgo.toISOString();
      case '6months':
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        return sixMonthsAgo.toISOString();
      case 'ytd':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        return yearStart.toISOString();
      case '1year':
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        return oneYearAgo.toISOString();
      default:
        return null;
    }
  };

  const processHistoricalData = (titles: Content[]) => {
    return titles.reduce((acc, title) => ({
      totalRevenue: acc.totalRevenue + (title.previous_gross_amount || 0),
      totalExpenses: acc.totalExpenses + (title.previous_expenses || 0) + (title.previous_distribution_fee || 0),
      totalPaid: acc.totalPaid + (title.previous_amount_paid || 0),
      balanceDue: acc.balanceDue + (title.previous_balance_due || 0),
    }), {
      totalRevenue: 0,
      totalExpenses: 0,
      totalPaid: 0,
      balanceDue: 0,
    });
  };

  const processStreamingPayments = (payments: StreamingPayment[]) => {
    return payments.reduce((acc, payment) => ({
      totalRevenue: acc.totalRevenue + (payment.gross_amount || 0),
      totalExpenses: acc.totalExpenses + ((payment.gross_amount || 0) * (payment.distribution_percentage || 50) / 100),
      netIncome: acc.netIncome + (payment.net_amount || 0),
    }), {
      totalRevenue: 0,
      totalExpenses: 0,
      netIncome: 0,
    });
  };

  const generateChartData = (titles: Content[], payments: StreamingPayment[]) => {
    const monthlyData = new Map<string, ChartDataPoint>();

    // Process historical data (assign to creation month)
    titles.forEach(title => {
      if (title.previous_gross_amount && title.previous_gross_amount > 0) {
        const month = new Date(title.created_at).toISOString().substring(0, 7);
        const existing = monthlyData.get(month) || {
          period: new Date(title.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
          revenue: 0,
          expenses: 0,
          net: 0,
          paid: 0,
        };

        existing.revenue += title.previous_gross_amount || 0;
        existing.expenses += (title.previous_expenses || 0) + (title.previous_distribution_fee || 0);
        existing.net += title.previous_net_revenue || 0;
        existing.paid += title.previous_amount_paid || 0;

        monthlyData.set(month, existing);
      }
    });

    // Process streaming payments
    payments.forEach(payment => {
      const month = payment.payment_date.substring(0, 7);
      const existing = monthlyData.get(month) || {
        period: new Date(payment.payment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        revenue: 0,
        expenses: 0,
        net: 0,
        paid: 0,
      };

      existing.revenue += payment.gross_amount || 0;
      existing.expenses += (payment.gross_amount || 0) * (payment.distribution_percentage || 50) / 100;
      existing.net += payment.net_amount || 0;

      monthlyData.set(month, existing);
    });

    return Array.from(monthlyData.values()).sort((a, b) => 
      new Date(a.period).getTime() - new Date(b.period).getTime()
    );
  };

  useEffect(() => {
    const fetchFinancialData = async () => {
      if (!userId && userRole === 'filmmaker') return;

      setLoading(true);
      try {
        // Fetch titles based on role
        let titlesQuery = supabase.from('content').select('*');
        
        if (userRole === 'filmmaker' && userId) {
          titlesQuery = titlesQuery.eq('filmmaker_id', userId);
        }
        
        if (selectedTitle) {
          titlesQuery = titlesQuery.eq('id', selectedTitle);
        }

        const { data: titlesData, error: titlesError } = await titlesQuery;
        if (titlesError) throw titlesError;

        const filteredTitles = titlesData || [];
        setTitles(filteredTitles);

        // Fetch streaming payments
        let paymentsQuery = supabase
          .from('streaming_payments')
          .select(`
            *,
            content!inner(title_name, filmmaker_id)
          `);

        const dateFilter = getDateFilter();
        if (dateFilter) {
          paymentsQuery = paymentsQuery.gte('payment_date', dateFilter);
        }

        if (userRole === 'filmmaker' && userId) {
          paymentsQuery = paymentsQuery.eq('content.filmmaker_id', userId);
        }

        if (selectedTitle) {
          paymentsQuery = paymentsQuery.eq('title_id', selectedTitle);
        }

        const { data: paymentsData, error: paymentsError } = await paymentsQuery;
        if (paymentsError) throw paymentsError;

        const streamingPayments = paymentsData || [];

        // Process historical data
        const historicalTotals = processHistoricalData(filteredTitles);
        
        // Process streaming payments
        const streamingTotals = processStreamingPayments(streamingPayments);

        // Calculate combined totals
        const totalRevenue = historicalTotals.totalRevenue + streamingTotals.totalRevenue;
        const totalExpenses = historicalTotals.totalExpenses + streamingTotals.totalExpenses;
        const netIncome = totalRevenue - totalExpenses;
        const totalPaid = historicalTotals.totalPaid;
        const balanceDue = Math.max(0, netIncome - totalPaid);
        const netProfitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

        setFinancialData({
          totalRevenue,
          totalExpenses,
          netIncome,
          totalPaid,
          balanceDue,
          netProfitMargin,
        });

        // Generate chart data
        const chartData = generateChartData(filteredTitles, streamingPayments);
        setChartData(chartData);

      } catch (error) {
        console.error('Error fetching financial data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFinancialData();
  }, [userId, userRole, selectedTitle, dateRange]);

  return {
    financialData,
    chartData,
    titles,
    loading,
  };
}