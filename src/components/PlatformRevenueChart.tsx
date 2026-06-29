import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Tv } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { supabase } from '../lib/supabase';

interface PlatformRevenue {
  channel: string;
  revenue: number;
  count: number;
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1',
];

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { channel, revenue, count } = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1">{channel}</p>
      <p className="text-green-700">Revenue: <span className="font-medium">${revenue.toLocaleString()}</span></p>
      <p className="text-gray-500">{count} payment{count !== 1 ? 's' : ''}</p>
    </div>
  );
};

export function PlatformRevenueChart() {
  const [data, setData] = useState<PlatformRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const { data: payments, error } = await supabase
          .from('payments')
          .select('channel, gross_amount');

        if (error) throw error;

        const map = new Map<string, { revenue: number; count: number }>();
        for (const p of payments ?? []) {
          const ch = p.channel || 'Unknown';
          const existing = map.get(ch) ?? { revenue: 0, count: 0 };
          map.set(ch, { revenue: existing.revenue + (p.gross_amount ?? 0), count: existing.count + 1 });
        }

        const rows: PlatformRevenue[] = Array.from(map.entries())
          .map(([channel, v]) => ({ channel, ...v }))
          .sort((a, b) => b.revenue - a.revenue);

        setData(rows);
      } catch (e) {
        console.error('PlatformRevenueChart error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const total = data.reduce((s, d) => s + d.revenue, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Tv className="h-5 w-5 text-blue-600" />
            Revenue by Platform
          </h3>
          <span className="text-sm text-gray-500">
            {data.length} platform{data.length !== 1 ? 's' : ''} · {fmt(total)} total
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Tv className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">No payment data available</p>
          </div>
        ) : (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="channel"
                  tick={{ fontSize: 11 }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={60} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]} name="Revenue">
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Mini table */}
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Platform</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Share</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Payments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.map((row, i) => (
                    <tr key={row.channel} className="hover:bg-gray-50">
                      <td className="px-3 py-2 flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ background: COLORS[i % COLORS.length] }}
                        />
                        {row.channel}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">
                        ${row.revenue.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        {total > 0 ? ((row.revenue / total) * 100).toFixed(1) : 0}%
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
