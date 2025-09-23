import React from 'react';
import { Calendar, Filter, BarChart3 } from 'lucide-react';
import { Button } from './ui/Button';

interface FilterOptions {
  selectedTitle: string;
  dateRange: string;
  chartType: 'bar' | 'line' | 'stacked';
}

interface FinancialFiltersProps {
  titles: Array<{ id: string; title_name: string }>;
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
}

export function FinancialFilters({ titles, filters, onFiltersChange }: FinancialFiltersProps) {
  const dateRangeOptions = [
    { value: 'all', label: 'All Time' },
    { value: '3months', label: 'Last 3 Months' },
    { value: '6months', label: 'Last 6 Months' },
    { value: 'ytd', label: 'Year to Date' },
    { value: '1year', label: 'Last 12 Months' },
  ];

  const chartTypeOptions = [
    { value: 'bar', label: 'Bar Chart' },
    { value: 'line', label: 'Line Chart' },
    { value: 'stacked', label: 'Stacked Bar' },
  ];

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters:</span>
        </div>

        {/* Title Filter */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-600">Title:</label>
          <select
            value={filters.selectedTitle}
            onChange={(e) => onFiltersChange({ ...filters, selectedTitle: e.target.value })}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Titles</option>
            {titles.map((title) => (
              <option key={title.id} value={title.id}>
                {title.title_name}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <label className="text-sm text-gray-600">Period:</label>
          <select
            value={filters.dateRange}
            onChange={(e) => onFiltersChange({ ...filters, dateRange: e.target.value })}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {dateRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Chart Type Filter */}
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-4 w-4 text-gray-500" />
          <label className="text-sm text-gray-600">Chart:</label>
          <select
            value={filters.chartType}
            onChange={(e) => onFiltersChange({ ...filters, chartType: e.target.value as 'bar' | 'line' | 'stacked' })}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {chartTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}