import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, Percent } from 'lucide-react';
import { Card, CardContent } from './ui/Card';

interface FinancialMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  totalPaid: number;
  balanceDue: number;
  netProfitMargin: number;
}

interface FinancialSummaryProps {
  metrics: FinancialMetrics;
  previousMetrics?: FinancialMetrics;
  showTrends?: boolean;
}

export function FinancialSummary({ metrics, previousMetrics, showTrends = false }: FinancialSummaryProps) {
  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const getTrendIcon = (current: number, previous: number) => {
    if (!previous || current === previous) return null;
    return current > previous ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    );
  };

  const getTrendPercent = (current: number, previous: number) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    return (
      <span className={`text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {change >= 0 ? '+' : ''}{change.toFixed(1)}%
      </span>
    );
  };

  const MetricCard = ({
    icon: Icon,
    title,
    value,
    color,
    previousValue
  }: {
    icon: any;
    title: string;
    value: string;
    color: string;
    previousValue?: number;
  }) => (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${color} flex-shrink-0`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold text-gray-900 break-words">{value}</p>
            {showTrends && previousValue !== undefined && (
              <div className="flex items-center space-x-1 flex-shrink-0">
                {getTrendIcon(parseFloat(value.replace(/[$,]/g, '')), previousValue)}
                {getTrendPercent(parseFloat(value.replace(/[$,]/g, '')), previousValue)}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <MetricCard
        icon={DollarSign}
        title="Total Revenue"
        value={formatCurrency(metrics.totalRevenue)}
        color="bg-green-600"
        previousValue={previousMetrics?.totalRevenue}
      />
      <MetricCard
        icon={TrendingDown}
        title="Total Expenses"
        value={formatCurrency(metrics.totalExpenses)}
        color="bg-red-600"
        previousValue={previousMetrics?.totalExpenses}
      />
      <MetricCard
        icon={TrendingUp}
        title="Net Income"
        value={formatCurrency(metrics.netIncome)}
        color="bg-blue-600"
        previousValue={previousMetrics?.netIncome}
      />
      <MetricCard
        icon={DollarSign}
        title="Total Paid"
        value={formatCurrency(metrics.totalPaid)}
        color="bg-purple-600"
        previousValue={previousMetrics?.totalPaid}
      />
      <MetricCard
        icon={DollarSign}
        title="Balance Due"
        value={formatCurrency(metrics.balanceDue)}
        color="bg-orange-600"
        previousValue={previousMetrics?.balanceDue}
      />
      <MetricCard
        icon={Percent}
        title="Profit Margin"
        value={formatPercent(metrics.netProfitMargin)}
        color="bg-indigo-600"
        previousValue={previousMetrics?.netProfitMargin}
      />
    </div>
  );
}