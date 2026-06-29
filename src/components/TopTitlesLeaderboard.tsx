import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { supabase } from '../lib/supabase';

interface TitleRevenue {
  title: string;
  revenue: number;
  payments: number;
}

const MEDALS: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };
const BAR_COLOR = '#3B82F6';

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { title, revenue, payments } = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm max-w-[200px]">
      <p className="font-semibold text-gray-900 mb-1 break-words">{title}</p>
      <p className="text-blue-700">Revenue: <span className="font-medium">${revenue.toLocaleString()}</span></p>
      <p className="text-gray-500">{payments} payment{payments !== 1 ? 's' : ''}</p>
    </div>
  );
};

export function TopTitlesLeaderboard() {
  const [data, setData] = useState<TitleRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const { data: payments, error } = await supabase
          .from('payments')
          .select('gross_amount, title_name, content_id, content:content(title_name)');

        if (error) throw error;

        const map = new Map<string, { revenue: number; payments: number }>();
        for (const p of payments ?? []) {
          const name = (p.content as any)?.title_name || p.title_name || 'Unknown';
          const existing = map.get(name) ?? { revenue: 0, payments: 0 };
          map.set(name, { revenue: existing.revenue + (p.gross_amount ?? 0), payments: existing.payments + 1 });
        }

        const top10: TitleRevenue[] = Array.from(map.entries())
          .map(([title, v]) => ({ title, ...v }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);

        setData(top10);
      } catch (e) {
        console.error('TopTitlesLeaderboard error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Truncate for axis labels
  const chartData = data.map(d => ({
    ...d,
    label: d.title.length > 18 ? d.title.slice(0, 16) + '…' : d.title,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Top 10 Titles by Revenue
          </h3>
          <span className="text-sm text-gray-500">All time</span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Trophy className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">No revenue data available</p>
          </div>
        ) : (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 70 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`}
                  tick={{ fontSize: 11 }}
                  width={56}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]} name="Revenue">
                  {chartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#CD7C4B' : BAR_COLOR}
                      fillOpacity={i < 3 ? 1 : 0.75}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Ranked list */}
            <div className="space-y-1">
              {data.map((row, i) => (
                <div key={row.title} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                  <span className="w-6 text-center text-sm font-bold text-gray-400">
                    {MEDALS[i] ?? `${i + 1}`}
                  </span>
                  <span className="flex-1 text-sm text-gray-800 truncate">{row.title}</span>
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">
                    ${row.revenue.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
