import React from 'react';
import { Download, FileText, Table } from 'lucide-react';
import { Button } from './ui/Button';

interface ExportData {
  metrics: any;
  chartData: any[];
  selectedTitle: string;
  dateRange: string;
  titles: Array<{ id: string; title_name: string }>;
}

interface ExportButtonsProps {
  data: ExportData;
  userRole: string;
}

export function ExportButtons({ data, userRole }: ExportButtonsProps) {
  const generateFilename = (extension: string) => {
    const titleName = data.selectedTitle 
      ? data.titles.find(t => t.id === data.selectedTitle)?.title_name || 'All_Titles'
      : 'All_Titles';
    
    const period = data.dateRange === 'all' ? 'All_Time' : 
                  data.dateRange === '3months' ? 'Q3_2025' :
                  data.dateRange === '6months' ? 'H2_2025' :
                  data.dateRange === 'ytd' ? 'YTD_2025' :
                  '2025';
    
    const role = userRole === 'admin' ? 'Admin' : 'Filmmaker';
    
    return `${titleName}_Financial_Report_${period}_${role}.${extension}`;
  };

  const exportToPDF = async () => {
    try {
      // Create a simple HTML report
      const reportHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Financial Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
            .metric { padding: 15px; border: 1px solid #ddd; border-radius: 8px; text-align: center; }
            .metric-value { font-size: 24px; font-weight: bold; color: #333; }
            .metric-label { font-size: 14px; color: #666; margin-top: 5px; }
            .chart-placeholder { height: 300px; border: 1px solid #ddd; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: #f9f9f9; }
            .data-table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            .data-table th, .data-table td { padding: 10px; border: 1px solid #ddd; text-align: left; }
            .data-table th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Financial Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
            <p>Period: ${data.dateRange} | Title: ${data.selectedTitle ? data.titles.find(t => t.id === data.selectedTitle)?.title_name : 'All Titles'}</p>
          </div>
          
          <div class="metrics">
            <div class="metric">
              <div class="metric-value">$${data.metrics.totalRevenue.toLocaleString()}</div>
              <div class="metric-label">Total Revenue</div>
            </div>
            <div class="metric">
              <div class="metric-value">$${data.metrics.totalExpenses.toLocaleString()}</div>
              <div class="metric-label">Total Expenses</div>
            </div>
            <div class="metric">
              <div class="metric-value">$${data.metrics.netIncome.toLocaleString()}</div>
              <div class="metric-label">Net Income</div>
            </div>
            <div class="metric">
              <div class="metric-value">$${data.metrics.totalPaid.toLocaleString()}</div>
              <div class="metric-label">Total Paid</div>
            </div>
            <div class="metric">
              <div class="metric-value">$${data.metrics.balanceDue.toLocaleString()}</div>
              <div class="metric-label">Balance Due</div>
            </div>
            <div class="metric">
              <div class="metric-value">${data.metrics.netProfitMargin.toFixed(1)}%</div>
              <div class="metric-label">Profit Margin</div>
            </div>
          </div>
          
          <div class="chart-placeholder">
            <p>Chart visualization would appear here in full PDF export</p>
          </div>
          
          <table class="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Revenue</th>
                <th>Expenses</th>
                <th>Net Income</th>
                <th>Paid</th>
              </tr>
            </thead>
            <tbody>
              ${data.chartData.map(row => `
                <tr>
                  <td>${row.period}</td>
                  <td>$${row.revenue.toLocaleString()}</td>
                  <td>$${row.expenses.toLocaleString()}</td>
                  <td>$${row.net.toLocaleString()}</td>
                  <td>$${row.paid.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;

      // Create a blob and download
      const blob = new Blob([reportHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generateFilename('html');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('Report exported successfully! Note: For full PDF functionality, a PDF library would be integrated.');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error exporting report. Please try again.');
    }
  };

  const exportToCSV = () => {
    try {
      const csvHeaders = ['Period', 'Revenue', 'Expenses', 'Net Income', 'Paid'];
      const csvRows = data.chartData.map(row => [
        row.period,
        row.revenue,
        row.expenses,
        row.net,
        row.paid
      ]);

      // Add summary metrics at the top
      const summaryRows = [
        ['Financial Summary', '', '', '', ''],
        ['Total Revenue', data.metrics.totalRevenue, '', '', ''],
        ['Total Expenses', data.metrics.totalExpenses, '', '', ''],
        ['Net Income', data.metrics.netIncome, '', '', ''],
        ['Total Paid', data.metrics.totalPaid, '', '', ''],
        ['Balance Due', data.metrics.balanceDue, '', '', ''],
        ['Profit Margin %', data.metrics.netProfitMargin, '', '', ''],
        ['', '', '', '', ''],
        ['Period Data', '', '', '', ''],
      ];

      const allRows = [...summaryRows, csvHeaders, ...csvRows];
      const csvContent = allRows.map(row => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generateFilename('csv');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error exporting CSV. Please try again.');
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <Button
        variant="secondary"
        size="sm"
        onClick={exportToPDF}
        className="flex items-center space-x-2"
      >
        <FileText className="h-4 w-4" />
        <span>Export PDF</span>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={exportToCSV}
        className="flex items-center space-x-2"
      >
        <Table className="h-4 w-4" />
        <span>Export CSV</span>
      </Button>
    </div>
  );
}