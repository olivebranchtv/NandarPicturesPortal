import React, { useState, useEffect } from 'react';
import { AlertCircle, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { supabase } from '../lib/supabase';

interface FilmmakerBalance {
  id: string;
  name: string;
  email: string;
  totalEarned: number;
  totalPaid: number;
  balanceDue: number;
}

export function BalancesDueCard() {
  const [rows, setRows] = useState<FilmmakerBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const [usersRes, paymentsRes, requestsRes] = await Promise.all([
          supabase.from('users').select('id, first_name, last_name, email').eq('role', 'filmmaker'),
          supabase.from('payments').select('filmmaker_id, net_amount'),
          supabase.from('payment_requests').select('filmmaker_id, amount_approved, status').eq('status', 'paid'),
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

        const result: FilmmakerBalance[] = (usersRes.data ?? [])
          .map(u => {
            const totalEarned = earnedMap.get(u.id) ?? 0;
            const totalPaid = paidMap.get(u.id) ?? 0;
            return {
              id: u.id,
              name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
              email: u.email,
              totalEarned,
              totalPaid,
              balanceDue: Math.max(0, totalEarned - totalPaid),
            };
          })
          .filter(r => r.balanceDue > 0)
          .sort((a, b) => b.balanceDue - a.balanceDue);

        setRows(result);
      } catch (e) {
        console.error('BalancesDueCard error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalDue = rows.reduce((s, r) => s + r.balanceDue, 0);

  if (!loading && rows.length === 0) return null;

  return (
    <Card className="border-orange-200 bg-orange-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900">Balances Due to Filmmakers</h3>
            {!loading && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                {rows.length} filmmaker{rows.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!loading && totalDue > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-bold shadow-sm">
                <DollarSign className="h-3.5 w-3.5" />
                {totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total owed
              </div>
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded-lg hover:bg-orange-100 text-gray-500 transition-colors"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {loading ? (
            <div className="py-6 text-center text-sm text-gray-400">Loading…</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-orange-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-orange-50 border-b border-orange-100">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Filmmaker</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Earned</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Already Paid</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <span className="text-orange-600">Balance Due</span>
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">% Paid Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-50 bg-white">
                  {rows.map((r, i) => {
                    const pct = r.totalEarned > 0 ? (r.totalPaid / r.totalEarned) * 100 : 0;
                    return (
                      <tr key={r.id} className={i === 0 ? 'bg-orange-50/60' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {i === 0 && (
                              <span className="text-xs font-bold text-orange-500 uppercase tracking-wide">Highest</span>
                            )}
                            <div>
                              <p className="font-medium text-gray-900">{r.name}</p>
                              <p className="text-xs text-gray-400">{r.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                          ${r.totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                          ${r.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className="font-bold text-orange-600 text-base">
                            ${r.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-green-500"
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 tabular-nums w-9 text-right">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-orange-100 border-t-2 border-orange-200 font-semibold">
                    <td className="px-4 py-3 text-gray-700">
                      Total ({rows.length} filmmaker{rows.length !== 1 ? 's' : ''})
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                      ${rows.reduce((s, r) => s + r.totalEarned, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                      ${rows.reduce((s, r) => s + r.totalPaid, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="text-orange-700 font-bold text-base">
                        ${totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
