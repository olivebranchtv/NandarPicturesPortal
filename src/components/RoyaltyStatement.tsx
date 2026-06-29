import React, { useState, useEffect } from 'react';
import { FileText, Download, ChevronDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { supabase, User, Content } from '../lib/supabase';
import {
  buildPeriods,
  buildStatementData,
  generateRoyaltyStatementPDF,
  StatementPeriod,
} from '../lib/royaltyStatementPDF';

interface Props {
  filmmaker: User;
}

export function RoyaltyStatement({ filmmaker }: Props) {
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly'>('monthly');
  const [periods, setPeriods] = useState<StatementPeriod[]>([]);
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState<number>(0);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const built = buildPeriods(periodType);
    setPeriods(built);
    setSelectedPeriodIndex(built.length - 1); // default to most recent
  }, [periodType]);

  const handleGenerate = async () => {
    if (!supabase || periods.length === 0) return;
    const period = periods[selectedPeriodIndex];
    setGenerating(true);

    try {
      const [contentsResult, paymentsResult] = await Promise.all([
        supabase
          .from('content')
          .select('*, title_distribution_settings(*)')
          .or(`filmmaker_id.eq.${filmmaker.id},owner_id.eq.${filmmaker.id},owner_email.eq.${filmmaker.email}`),
        supabase
          .from('payments')
          .select('*')
          .gte('payment_date', period.startDate.toISOString().split('T')[0])
          .lte('payment_date', period.endDate.toISOString().split('T')[0]),
      ]);

      if (contentsResult.error) throw contentsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      const contents: Content[] = contentsResult.data ?? [];
      const filmmakerContentIds = new Set(contents.map(c => c.id));
      const payments = (paymentsResult.data ?? []).filter(
        p => p.content_id && filmmakerContentIds.has(p.content_id),
      );

      const statementData = buildStatementData(filmmaker, period, contents, payments);
      generateRoyaltyStatementPDF(statementData);
      toast.success(`Statement downloaded: ${period.label}`);
    } catch (err: any) {
      console.error('Error generating statement:', err);
      toast.error('Failed to generate statement. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Royalty Statements</h3>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Download a PDF statement showing per-title revenue, distribution splits, and net earnings.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Period type toggle */}
        <div className="flex space-x-2">
          <button
            onClick={() => setPeriodType('monthly')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
              periodType === 'monthly'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setPeriodType('quarterly')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
              periodType === 'quarterly'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            Quarterly
          </button>
        </div>

        {/* Period selector */}
        <div className="relative">
          <select
            value={selectedPeriodIndex}
            onChange={e => setSelectedPeriodIndex(Number(e.target.value))}
            className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {periods.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>

        {/* What's included note */}
        <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
          <p className="font-medium">Statement includes:</p>
          <ul className="mt-1 list-disc list-inside space-y-0.5 text-blue-700">
            <li>Per-title breakdown by streaming channel</li>
            <li>Gross revenue, distribution fee, and your net share</li>
            <li>Historical / legacy data (if any) on a separate section</li>
          </ul>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating || periods.length === 0}
          className="w-full flex items-center justify-center space-x-2"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating PDF…</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              <span>Download Statement</span>
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
