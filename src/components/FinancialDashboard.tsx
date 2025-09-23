import React, { useState } from 'react';
import { BarChart3, TrendingUp, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { FinancialChart } from './FinancialChart';
import { FinancialSummary } from './FinancialSummary';
import { FinancialFilters } from './FinancialFilters';
import { ExportButtons } from './ExportButtons';
import { useFinancialData } from '../hooks/useFinancialData';

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

  const { financialData, chartData, titles, loading } = useFinancialData({
    userId,
    userRole,
    selectedTitle: filters.selectedTitle,
    dateRange: filters.dateRange,
  });

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
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Revenue vs Expenses Over Time
            </h3>
            <div className="text-sm text-gray-500">
              {chartData.length} period{chartData.length !== 1 ? 's' : ''}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <FinancialChart
              data={chartData}
              chartType={filters.chartType}
              height={400}
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