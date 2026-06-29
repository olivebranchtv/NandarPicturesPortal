import React, { useState, useEffect } from 'react';
import { Users, Download, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { supabase } from '../lib/supabase';

interface FilmmakerRow {
  id: string;
  name: string;
  email: string;
  totalEarned: number;
  totalPaid: number;
  balanceDue: number;
  titleCount: number;
}

type SortKey = 'name' | 'totalEarned' | 'totalPaid' | 'balanceDue';
type SortDir = 'asc' | 'desc';

function exportCSV(rows: FilmmakerRow[]) {
  const headers = ['Name', 'Email', 'Titles', 'Total Earned', 'Total Paid', 'Balance Due'];
  const csvRows = rows.map(r => [
    r.name,
    r.email,
    r.titleCount,
    r.totalEarned.toFixed(2),
    r.totalPaid.toFixed(2),
    r.balanceDue.toFixed(2),
  ]);
  const csv = [headers, ...csvRows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `filmmaker-summary-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function FilmmakerSummaryReport() {
  const [rows, setRows] = useState<FilmmakerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('totalEarned');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const [usersRes, paymentsRes, requestsRes, contentRes] = await Promise.all([
          supabase.from('users').select('id, first_name, last_name, email').eq('role', 'filmmaker'),
          supabase.from('payments').select('filmmaker_id, net_amount'),
          supabase.from('payment_requests').select('filmmaker_id, amount_approved, status').in('status', ['paid']),
          supabase.from('content').select('filmmaker_id'),
        ]);

        if (usersRes.error) throw usersRes.error;

        const earnedMap = new Map<string, number>();
        for (const p of paymentsRes.data ?? []) {
          earnedMap.set(p.filmmaker_id, (earnedMap.get(p.filmmaker_id) ?? 0) + (p.net_amount ?? 0));
        }

        const paidMap = new Map<string, number>();
        for (const r of requestsRes.data ?? []) {
          paidMap.set(r.filmmaker_id, (paidMap.get(r.filmmaker_id) ?? 0) + (r.amount_approved ?? 0));
        }

        const titleMap = new Map<string, number>();
        for (const c of contentRes.data ?? []) {
          titleMap.set(c.filmmaker_id, (titleMap.get(c.filmmaker_id) ?? 0) + 1);
        }

        const result: FilmmakerRow[] = (usersRes.data ?? []).map(u => {
          const totalEarned = earnedMap.get(u.id) ?? 0;
          const totalPaid = paidMap.get(u.id) ?? 0;
          return {
            id: u.id,
            name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
            email: u.email,
            totalEarned,
            totalPaid,
            balanceDue: Math.max(0, totalEarned - totalPaid),
            titleCount: titleMap.get(u.id) ?? 0,
          };
        });

        setRows(result);
      } catch (e) {
        console.error('FilmmakerSummaryReport error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = rows
    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'name') return mul * a.name.localeCompare(b.name);
      return mul * (a[sortKey] - b[sortKey]);
    });

  const totals = {
    totalEarned: filtered.reduce((s, r) => s + r.totalEarned, 0),
    totalPaid: filtered.reduce((s, r) => s + r.totalPaid, 0),
    balanceDue: filtered.reduce((s, r) => s + r.balanceDue, 0),
  };

  const SortButton = ({ col }: { col: SortKey }) => (
    <button onClick={() => toggleSort(col)} className="inline-flex items-center gap-0.5 hover:text-gray-700">
      <ArrowUpDown className={`h-3 w-3 ${sortKey === col ? 'text-blue-600' : 'text-gray-400'}`} />
    </button>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Filmmaker Summary
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search filmmaker…"
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 w-48 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => exportCSV(filtered)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Users className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">No filmmakers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <span className="flex items-center gap-1">Filmmaker <SortButton col="name" /></span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Titles</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <span className="flex items-center justify-end gap-1">Total Earned <SortButton col="totalEarned" /></span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <span className="flex items-center justify-end gap-1">Total Paid <SortButton col="totalPaid" /></span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <span className="flex items-center justify-end gap-1">Balance Due <SortButton col="balanceDue" /></span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-400">{r.email}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{r.titleCount}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">
                      ${r.totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      ${r.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={r.balanceDue > 0 ? 'font-semibold text-orange-600' : 'text-gray-400'}>
                        ${r.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td className="px-4 py-3 font-semibold text-gray-700" colSpan={2}>
                    Total ({filtered.length} filmmaker{filtered.length !== 1 ? 's' : ''})
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">
                    ${totals.totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    ${totals.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-orange-600">
                    ${totals.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
