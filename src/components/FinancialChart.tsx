import React from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ChartData {
  period: string;
  revenue: number;
  expenses: number;
  net: number;
  paid: number;
}

interface FinancialChartProps {
  data: ChartData[];
  chartType: 'bar' | 'line' | 'stacked';
  height?: number;
  priorYearData?: ChartData[];
  showYoY?: boolean;
}

export function FinancialChart({ data, chartType, height = 400, priorYearData, showYoY = false }: FinancialChartProps) {
  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

  // Merge prior year data onto each current-year period by index
  const mergedData = data.map((d, i) => ({
    ...d,
    priorRevenue: priorYearData?.[i]?.revenue ?? null,
    priorNet: priorYearData?.[i]?.net ?? null,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={mergedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis tickFormatter={formatCurrency} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#10B981"
            strokeWidth={3}
            name="Revenue"
            dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="expenses"
            stroke="#EF4444"
            strokeWidth={3}
            name="Expenses"
            dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="net"
            stroke="#3B82F6"
            strokeWidth={3}
            name="Net Income"
            dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
          />
          {showYoY && priorYearData && (
            <>
              <Line
                type="monotone"
                dataKey="priorRevenue"
                stroke="#10B981"
                strokeWidth={2}
                strokeDasharray="5 4"
                name="Prior Year Revenue"
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="priorNet"
                stroke="#3B82F6"
                strokeWidth={2}
                strokeDasharray="5 4"
                name="Prior Year Net"
                dot={false}
                connectNulls
              />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'stacked') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={mergedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis tickFormatter={formatCurrency} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="revenue" stackId="a" fill="#10B981" name="Revenue" />
          <Bar dataKey="expenses" stackId="a" fill="#EF4444" name="Expenses" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={mergedData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis tickFormatter={formatCurrency} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar dataKey="revenue" fill="#10B981" name="Revenue" />
        <Bar dataKey="expenses" fill="#EF4444" name="Expenses" />
        <Bar dataKey="net" fill="#3B82F6" name="Net Income" />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface TrendIndicatorProps {
  current: number;
  previous: number;
  label: string;
}

export function TrendIndicator({ current, previous, label }: TrendIndicatorProps) {
  const change = current - previous;
  const percentChange = previous !== 0 ? (change / previous) * 100 : 0;
  const isPositive = change >= 0;

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600">{label}</span>
      <div className={`flex items-center space-x-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? (
          <TrendingUp className="h-4 w-4" />
        ) : (
          <TrendingDown className="h-4 w-4" />
        )}
        <span className="text-sm font-medium">
          {Math.abs(percentChange).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}