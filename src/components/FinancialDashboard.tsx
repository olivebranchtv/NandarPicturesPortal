import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Settings, GitCompare } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { FinancialChart } from './FinancialChart';
import { FinancialSummary } from './FinancialSummary';
import { FinancialFilters } from './FinancialFilters';
import { ExportButtons } from './ExportButtons';
import { PlatformRevenueChart } from './PlatformRevenueChart';
import { useFinancialData } from '../hooks/useFinancialData';
import { supabase } from '../lib/supabase';

interface FinancialDashboardProps {
  userId?: string;
  userRole: 'admin' | 'filmmaker';
}

export function FinancialDashboard({ userId, userRole }: FinancialDashboardProps) {
  const [filters, setFilters] = useState({
    selectedTitle: '',
    dateRange: 'all',
    chartType: 'bar' as 'bar' | 'line' | 'stacked',
  });
  const [showYoY, setShowYoY] = useState(false);

  const { financialData, chartData, titles, loading } = useFinancialData({
    userId,
    userRole,
    selectedTitle: filters.selectedTitle,
    dateRange: filters.dateRange,
  });

  // Fetch prior year payment data for YoY overlay
  const [priorYearData, setPriorYearData] = useState<typeof chartData>([]);
  useEffect(() => {
    if (!showYoY || !supabase) return;
    const now = new Date();
    const start = new Date(now.getFullYear() - 2, 0, 1).toISOString();
    const end = new Date(now.getFullYear() - 1, 11, 31).toISOString();
    supabase
      .from('payments')
      .select('payment_date, gross_amount, distribution_fee, net_amount')
      .gte('payment_date', start)
      .lte('payment_date', end)
      .then(({ data: rows }) => {
        if (!rows) return;
        const map = new Map<string, { revenue: number; expenses: number; net: number; paid: number }>();
        for (const r of rows) {
          const key = r.payment_date?.slice(0, 7) ?? '';
          const existing = map.get(key) ?? { revenue: 0, expenses: 0, net: 0, paid: 0 };
          map.set(key, {
            revenue: existing.revenue + (r.gross_amount ?? 0),
            expenses: existing.expenses + (r.distribution_fee ?? 0),
            net: existing.net + (r.net_amount ?? 0),
            paid: existing.paid,
          });
        }
        const sorted = Array.from(map.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([period, v]) => ({ period, ...v }));
        setPriorYearData(sorted);
      });
  }, [showYoY]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const exportData = {
    metrics: financialData,
    chartData,
    selectedTitle: filters.selectedTitle,
    dateRange: filters.dateRange,
    titles: titles.map(t => ({ id: t.id, title_name: t.title_name })),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Financial Dashboard</h2>
        </div>
        <ExportButtons data={exportData} userRole={userRole} />
      </div>

      {/* Filters */}
      <FinancialFilters
        titles={titles.map(t => ({ id: t.id, title_name: t.title_name }))}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Summary Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Financial Summary
        </h3>
        <FinancialSummary metrics={financialData} showTrends={true} />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-semibold flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Revenue vs Expenses Over Time
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowYoY(v => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  showYoY
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
                title="Overlay prior year revenue (dashed lines) — only visible in Line chart mode"
              >
                <GitCompare className="h-3.5 w-3.5" />
                YoY
              </button>
              <span className="text-sm text-gray-500">
                {chartData.length} period{chartData.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          {showYoY && filters.chartType !== 'line' && (
            <p className="text-xs text-amber-600 mt-1">Switch to Line chart type to see YoY overlay</p>
          )}
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <FinancialChart
              data={chartData}
              chartType={filters.chartType}
              height={400}
              priorYearData={priorYearData}
              showYoY={showYoY}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No financial data available for the selected period</p>
                <p className="text-sm">Try adjusting your filters or date range</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-platform breakdown — admin only */}
      {userRole === 'admin' && <PlatformRevenueChart />}

      {/* Additional Insights */}
      {userRole === 'admin' && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Admin Insights
            </h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">Total Titles</p>
                <p className="text-2xl font-bold text-blue-900">{titles.length}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600 font-medium">Avg Revenue per Title</p>
                <p className="text-2xl font-bold text-green-900">
                  ${titles.length > 0 ? (financialData.totalRevenue / titles.length).toLocaleString() : '0'}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-600 font-medium">Collection Rate</p>
                <p className="text-2xl font-bold text-purple-900">
                  {financialData.totalRevenue > 0 
                    ? ((financialData.totalPaid / financialData.totalRevenue) * 100).toFixed(1)
                    : '0'
                  }%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}