import React, { useState, useEffect } from 'react';
import { FileText, Download, AlertCircle, CheckCircle, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { supabase, User } from '../lib/supabase';
import { generate1099PDF } from '../lib/generate1099PDF';

interface FilmmakerTaxRow {
  filmmaker: User & { zelle_identifier?: string };
  year: number;
  totalPaid: number;
  reportable: boolean; // >= $600
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export function TaxDocuments() {
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR - 1); // default: prior tax year
  const [rows, setRows] = useState<FilmmakerTaxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [usersRes, requestsRes] = await Promise.all([
        supabase.from('users').select('*').eq('role', 'filmmaker'),
        supabase
          .from('payment_requests')
          .select('filmmaker_id, amount_approved, amount_requested, status, date_paid')
          .eq('status', 'paid')
          .gte('date_paid', `${selectedYear}-01-01`)
          .lte('date_paid', `${selectedYear}-12-31`),
      ]);

      const filmmakers: (User & { zelle_identifier?: string })[] = usersRes.data ?? [];
      const requests = requestsRes.data ?? [];

      const paidMap = new Map<string, number>();
      for (const r of requests) {
        const amt = r.amount_approved ?? r.amount_requested ?? 0;
        paidMap.set(r.filmmaker_id, (paidMap.get(r.filmmaker_id) ?? 0) + amt);
      }

      const result: FilmmakerTaxRow[] = filmmakers.map(fm => {
        const totalPaid = paidMap.get(fm.id) ?? 0;
        return { filmmaker: fm, year: selectedYear, totalPaid, reportable: totalPaid >= 600 };
      });

      // Sort: reportable first, then by totalPaid desc
      result.sort((a, b) => {
        if (a.reportable !== b.reportable) return a.reportable ? -1 : 1;
        return b.totalPaid - a.totalPaid;
      });

      setRows(result);
    } catch (e) {
      console.error('TaxDocuments fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (row: FilmmakerTaxRow) => {
    setGenerating(row.filmmaker.id);
    try {
      await generate1099PDF({
        year: row.year,
        filmmaker: row.filmmaker,
        totalPaid: row.totalPaid,
        federalTaxWithheld: 0,
        stateTaxWithheld: 0,
      });
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateAll = async () => {
    const reportable = rows.filter(r => r.reportable);
    for (const row of reportable) {
      setGenerating(row.filmmaker.id);
      await generate1099PDF({
        year: row.year,
        filmmaker: row.filmmaker,
        totalPaid: row.totalPaid,
        federalTaxWithheld: 0,
        stateTaxWithheld: 0,
      });
      await new Promise(r => setTimeout(r, 400)); // slight delay between PDFs
    }
    setGenerating(null);
  };

  const reportableCount = rows.filter(r => r.reportable).length;
  const totalPaidAll = rows.reduce((s, r) => s + r.totalPaid, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">1099-NEC Tax Documents</h3>
            {!loading && reportableCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                {reportableCount} reportable
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Year picker */}
            <div className="relative">
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="appearance-none rounded-lg border border-gray-300 bg-white pl-3 pr-8 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {YEARS.map(y => (
                  <option key={y} value={y}>Tax Year {y}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            </div>

            {reportableCount > 1 && (
              <button
                onClick={handleGenerateAll}
                disabled={!!generating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download All ({reportableCount})
              </button>
            )}
          </div>
        </div>

        {/* IRS threshold notice */}
        <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            IRS requires a 1099-NEC for any filmmaker paid <strong>$600 or more</strong> in a calendar year.
            Filmmakers below this threshold are shown for your records but marked as non-reportable.
            File Copy A with the IRS and send Copy B to each filmmaker by <strong>January 31</strong>.
          </p>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <FileText className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">No filmmakers found</p>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 bg-gray-50">
              <div className="px-4 py-3">
                <p className="text-xs text-gray-500">Total filmmakers</p>
                <p className="text-lg font-bold text-gray-900">{rows.length}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-gray-500">Reportable (≥ $600)</p>
                <p className="text-lg font-bold text-amber-600">{reportableCount}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-gray-500">Total paid {selectedYear}</p>
                <p className="text-lg font-bold text-green-700">
                  ${totalPaidAll.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {rows.map(row => {
                const name = [row.filmmaker.first_name, row.filmmaker.last_name].filter(Boolean).join(' ') || row.filmmaker.email;
                const hasAddress = row.filmmaker.address && row.filmmaker.city;
                const isGenerating = generating === row.filmmaker.id;

                return (
                  <div key={row.filmmaker.id} className={`flex items-center gap-4 px-4 py-3 ${row.reportable ? 'hover:bg-amber-50/40' : 'hover:bg-gray-50 opacity-75'}`}>
                    {/* Status icon */}
                    <div className="flex-shrink-0">
                      {row.reportable
                        ? <AlertCircle className="h-4 w-4 text-amber-500" />
                        : <CheckCircle className="h-4 w-4 text-gray-300" />
                      }
                    </div>

                    {/* Filmmaker info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                        {row.reportable
                          ? <span className="flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">1099 required</span>
                          : <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">below $600</span>
                        }
                      </div>
                      <p className="text-xs text-gray-400 truncate">{row.filmmaker.email}</p>
                      {!hasAddress && row.reportable && (
                        <p className="text-xs text-red-500 mt-0.5">⚠ Missing address — ask filmmaker to update profile</p>
                      )}
                    </div>

                    {/* Address */}
                    <div className="hidden md:block text-xs text-gray-500 w-48 truncate">
                      {hasAddress
                        ? `${row.filmmaker.address}, ${row.filmmaker.city}, ${row.filmmaker.state} ${row.filmmaker.zip_code ?? ''}`
                        : <span className="text-gray-300 italic">no address on file</span>
                      }
                    </div>

                    {/* Amount */}
                    <div className="text-right w-28">
                      <p className={`text-sm font-bold tabular-nums ${row.reportable ? 'text-gray-900' : 'text-gray-400'}`}>
                        ${row.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-400">paid {selectedYear}</p>
                    </div>

                    {/* Download button */}
                    <button
                      onClick={() => handleGenerate(row)}
                      disabled={!!generating}
                      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        row.reportable
                          ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-60'
                      }`}
                    >
                      {isGenerating
                        ? <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
                        : <Download className="h-3 w-3" />
                      }
                      {isGenerating ? 'Generating…' : '1099 PDF'}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
