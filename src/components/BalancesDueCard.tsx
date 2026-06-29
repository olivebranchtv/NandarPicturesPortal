import React, { useState, useEffect } from 'react';
import { AlertCircle, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { supabase } from '../lib/supabase';

interface FilmmakerBalance {
  id: string;
  name: string;
  email: string;
  titles: string[];
  streamingNet: number;
  historicalBalanceDue: number;
  paidViaRequests: number;
  availableBalance: number;
}

export function BalancesDueCard() {
  const [rows, setRows] = useState<FilmmakerBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        // 1. All filmmakers
        const usersRes = await supabase
          .from('users')
          .select('id, first_name, last_name, email')
          .eq('role', 'filmmaker');
        if (usersRes.error) throw usersRes.error;
        const filmmakers = usersRes.data ?? [];

        // Build email → filmmaker id map for owner_email fallback
        const emailToId = new Map<string, string>();
        const idToEmail = new Map<string, string>();
        for (const u of filmmakers) {
          if (u.email) emailToId.set(u.email.toLowerCase(), u.id);
          idToEmail.set(u.id, u.email?.toLowerCase() ?? '');
        }

        // 2. All content — resolve filmmaker via filmmaker_id, owner_id, or owner_email
        const contentRes = await supabase
          .from('content')
          .select('id, filmmaker_id, owner_id, owner_email, previous_balance_due, title_name');
        const contents = contentRes.data ?? [];

        // Build map: filmmaker id → sum of previous_balance_due
        const historicalMap = new Map<string, number>();
        // Build map: content_id → filmmaker id (for payments join)
        const contentFilmmakerMap = new Map<string, string>();
        // Build map: filmmaker id → title names
        const titlesMap = new Map<string, string[]>();
        for (const c of contents) {
          const fid =
            c.filmmaker_id ||
            c.owner_id ||
            (c.owner_email ? emailToId.get(c.owner_email.toLowerCase()) : undefined);
          if (!fid) continue;
          contentFilmmakerMap.set(c.id, fid);
          if (c.title_name) {
            const existing = titlesMap.get(fid) ?? [];
            if (!existing.includes(c.title_name)) titlesMap.set(fid, [...existing, c.title_name]);
          }
          if (c.previous_balance_due && c.previous_balance_due > 0) {
            historicalMap.set(fid, (historicalMap.get(fid) ?? 0) + c.previous_balance_due);
          }
        }

        // 3. Streaming net from payments + streaming_payments — paginate to avoid 1000-row default cap
        const streamingNetMap = new Map<string, number>();
        const BATCH = 1000;

        // payments table
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data } = await supabase
            .from('payments')
            .select('content_id, net_amount')
            .range(from, from + BATCH - 1);
          for (const p of data ?? []) {
            const fid = contentFilmmakerMap.get(p.content_id);
            if (fid) streamingNetMap.set(fid, (streamingNetMap.get(fid) ?? 0) + (p.net_amount ?? 0));
          }
          hasMore = (data?.length ?? 0) === BATCH;
          from += BATCH;
        }

        // streaming_payments table
        from = 0; hasMore = true;
        while (hasMore) {
          const { data } = await supabase
            .from('streaming_payments')
            .select('title_id, net_amount')
            .range(from, from + BATCH - 1);
          for (const p of data ?? []) {
            const fid = contentFilmmakerMap.get(p.title_id);
            if (fid) streamingNetMap.set(fid, (streamingNetMap.get(fid) ?? 0) + (p.net_amount ?? 0));
          }
          hasMore = (data?.length ?? 0) === BATCH;
          from += BATCH;
        }

        // 4. Portal payouts already made (payment_requests status=paid)
        const requestsRes = await supabase
          .from('payment_requests')
          .select('filmmaker_id, amount_approved, amount_requested')
          .eq('status', 'paid');
        const paidMap = new Map<string, number>();
        for (const r of requestsRes.data ?? []) {
          const amt = r.amount_approved ?? r.amount_requested ?? 0;
          paidMap.set(r.filmmaker_id, (paidMap.get(r.filmmaker_id) ?? 0) + amt);
        }

        // 5. Compute available balance per filmmaker (same formula as FilmmakerDashboard)
        const result: FilmmakerBalance[] = filmmakers
          .map(u => {
            const streamingNet = streamingNetMap.get(u.id) ?? 0;
            const historicalBalanceDue = historicalMap.get(u.id) ?? 0;
            const paidViaRequests = paidMap.get(u.id) ?? 0;
            const availableBalance = Math.max(0, streamingNet + historicalBalanceDue - paidViaRequests);
            return {
              id: u.id,
              name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
              email: u.email,
              titles: titlesMap.get(u.id) ?? [],
              streamingNet,
              historicalBalanceDue,
              paidViaRequests,
              availableBalance,
            };
          })
          .filter(r => r.availableBalance > 0)
          .sort((a, b) => b.availableBalance - a.availableBalance);

        setRows(result);
      } catch (e) {
        console.error('BalancesDueCard error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalDue = rows.reduce((s, r) => s + r.availableBalance, 0);

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
          ) : rows.length === 0 ? (
            <div className="flex items-center gap-3 py-5 px-4 bg-green-50 rounded-lg border border-green-100">
              <div className="flex-shrink-0 p-2 bg-green-100 rounded-full">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">All filmmakers are fully paid up</p>
                <p className="text-xs text-green-600 mt-0.5">No outstanding balances at this time</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-orange-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-orange-50 border-b border-orange-100">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Filmmaker</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Streaming Net</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Historical Owed</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Already Paid</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <span className="text-orange-600">Available Balance</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-50 bg-white">
                  {rows.map((r, i) => (
                    <tr key={r.id} className={i === 0 ? 'bg-orange-50/60' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {i === 0 && (
                            <span className="text-xs font-bold text-orange-500 uppercase tracking-wide">Highest</span>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{r.name}</p>
                            <p className="text-xs text-gray-400">{r.email}</p>
                            {r.titles.length > 0 && (
                              <p className="text-xs text-blue-600 mt-0.5 italic">
                                {r.titles.join(' · ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                        ${r.streamingNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                        {r.historicalBalanceDue > 0
                          ? `$${r.historicalBalanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                        ${r.paidViaRequests.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="font-bold text-orange-600 text-base">
                          ${r.availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-orange-100 border-t-2 border-orange-200 font-semibold">
                    <td className="px-4 py-3 text-gray-700">
                      Total ({rows.length} filmmaker{rows.length !== 1 ? 's' : ''})
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                      ${rows.reduce((s, r) => s + r.streamingNet, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                      ${rows.reduce((s, r) => s + r.historicalBalanceDue, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                      ${rows.reduce((s, r) => s + r.paidViaRequests, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="text-orange-700 font-bold text-base">
                        ${totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
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
