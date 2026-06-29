import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock, XCircle, DollarSign, Search, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { supabase, PaymentRequest } from '../lib/supabase';

type StatusFilter = 'all' | 'approved' | 'rejected' | 'paid';

const STATUS_META = {
  approved: { label: 'Approved', icon: ShieldCheck, bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500', text: 'text-green-700', badge: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', icon: XCircle,    bg: 'bg-red-50',   border: 'border-red-200',   dot: 'bg-red-500',   text: 'text-red-700',   badge: 'bg-red-100 text-red-800'   },
  paid:     { label: 'Paid',     icon: DollarSign,  bg: 'bg-blue-50',  border: 'border-blue-200',  dot: 'bg-blue-500',  text: 'text-blue-700',  badge: 'bg-blue-100 text-blue-800'  },
  pending:  { label: 'Pending',  icon: Clock,       bg: 'bg-gray-50',  border: 'border-gray-200',  dot: 'bg-gray-400',  text: 'text-gray-600',  badge: 'bg-gray-100 text-gray-700'  },
} as const;

function fmt(dateStr: string | undefined | null, fallback = '—') {
  if (!dateStr) return fallback;
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function adminName(req: PaymentRequest) {
  if (!req.approver) return null;
  const name = [req.approver.first_name, req.approver.last_name].filter(Boolean).join(' ');
  return name || req.approver.email;
}

function filmmakerName(req: PaymentRequest) {
  const name = [req.filmmaker?.first_name, req.filmmaker?.last_name].filter(Boolean).join(' ');
  return name || req.filmmaker?.email || 'Unknown';
}

export function AuditLog() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [showCount, setShowCount] = useState(25);

  useEffect(() => {
    fetchLog();
  }, []);

  const fetchLog = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select(`
          *,
          filmmaker:users!payment_requests_filmmaker_id_fkey(first_name, last_name, email),
          approver:users!payment_requests_approved_by_fkey(first_name, last_name, email)
        `)
        .neq('status', 'pending')
        .order('approved_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setRequests(data ?? []);
    } catch (err) {
      console.error('Audit log fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = requests.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const fm = filmmakerName(r).toLowerCase();
      const adm = (adminName(r) ?? '').toLowerCase();
      if (!fm.includes(q) && !adm.includes(q)) return false;
    }
    return true;
  });

  const visible = filtered.slice(0, showCount);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            Audit Log
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value as StatusFilter); setShowCount(25); }}
                className="appearance-none rounded-lg border border-gray-300 bg-white pl-3 pr-8 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All actions</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="paid">Paid</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setShowCount(25); }}
                placeholder="Search filmmaker or admin…"
                className="rounded-lg border border-gray-300 bg-white pl-8 pr-3 py-1.5 text-sm text-gray-700 w-56 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <ShieldCheck className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No resolved requests match your filter.</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_120px_130px_160px_160px_180px] gap-x-4 px-6 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span>Filmmaker</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Requested</span>
              <span>Action taken</span>
              <span>By admin</span>
            </div>

            <div className="divide-y divide-gray-100">
              {visible.map(req => {
                const meta = STATUS_META[req.status as keyof typeof STATUS_META] ?? STATUS_META.pending;
                const Icon = meta.icon;
                const actionTime = req.status === 'paid' ? (req.date_paid ?? req.approved_at) : req.approved_at;

                return (
                  <div
                    key={req.id}
                    className={`px-6 py-4 ${meta.bg} sm:grid grid-cols-[1fr_120px_130px_160px_160px_180px] gap-x-4 items-start hover:brightness-[0.98] transition-all`}
                  >
                    {/* Filmmaker */}
                    <div className="min-w-0 mb-2 sm:mb-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{filmmakerName(req)}</p>
                      <p className="text-xs text-gray-400 truncate">{req.filmmaker?.email}</p>
                    </div>

                    {/* Amount */}
                    <div className="mb-2 sm:mb-0">
                      <p className="text-sm font-semibold text-gray-900">
                        ${(req.amount_approved ?? req.amount_requested).toLocaleString()}
                      </p>
                      {req.amount_approved && req.amount_approved !== req.amount_requested && (
                        <p className="text-xs text-gray-400 line-through">${req.amount_requested.toLocaleString()}</p>
                      )}
                    </div>

                    {/* Status badge */}
                    <div className="mb-2 sm:mb-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                      {req.payment_method_used && (
                        <p className="text-xs text-gray-500 mt-0.5">{req.payment_method_used}</p>
                      )}
                    </div>

                    {/* Requested at */}
                    <div className="mb-2 sm:mb-0">
                      <p className="text-xs text-gray-600">{fmt(req.requested_at)}</p>
                    </div>

                    {/* Action taken at */}
                    <div className="mb-2 sm:mb-0">
                      <p className="text-xs text-gray-600">{fmt(actionTime)}</p>
                    </div>

                    {/* Admin who acted */}
                    <div>
                      {adminName(req) ? (
                        <>
                          <p className="text-xs font-medium text-gray-700">{adminName(req)}</p>
                          <p className="text-xs text-gray-400">{req.approver?.email}</p>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 italic">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filtered.length > showCount && (
              <div className="px-6 py-4 border-t border-gray-100 text-center">
                <button
                  onClick={() => setShowCount(n => n + 25)}
                  className="flex items-center gap-1.5 mx-auto text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  <ChevronDown className="h-4 w-4" />
                  Show more ({filtered.length - showCount} remaining)
                </button>
              </div>
            )}

            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 text-right">
              {filtered.length} record{filtered.length !== 1 ? 's' : ''}
              {statusFilter !== 'all' || search ? ` (filtered from ${requests.length} total)` : ''}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
