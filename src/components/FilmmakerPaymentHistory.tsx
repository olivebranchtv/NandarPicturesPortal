import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { supabase, Payment } from '../lib/supabase';

interface FilmmakerPaymentHistoryProps {
  filmmakerI: string;
}

export function FilmmakerPaymentHistory({ filmmakerI }: FilmmakerPaymentHistoryProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayments();
  }, [filmmakerI]);

  const fetchPayments = async () => {
    try {
      // First, get all titles owned by this filmmaker
      const { data: titlesData, error: titlesError } = await supabase!
        .from('content')
        .select('id, email')
        .or(`filmmaker_id.eq.${filmmakerI},owner_id.eq.${filmmakerI}`);

      if (titlesError) throw titlesError;

      const titleIds = titlesData?.map(t => t.id) || [];

      if (titleIds.length === 0) {
        setPayments([]);
        setLoading(false);
        return;
      }

      // Fetch streaming payments for those titles
      const { data: streamingData, error: streamingError } = await supabase!
        .from('streaming_payments')
        .select(`
          *,
          content!streaming_payments_title_id_fkey(title_name, filmmaker_id)
        `)
        .in('title_id', titleIds)
        .order('payment_date', { ascending: false });

      if (streamingError) throw streamingError;

      // Transform streaming_payments to match Payment interface
      const transformedPayments = (streamingData || []).map(sp => ({
        id: sp.id,
        content_id: sp.title_id,
        filmmaker_id: filmmakerI,
        payment_date: sp.payment_date,
        gross_amount: sp.gross_amount || 0,
        distribution_fee: ((sp.gross_amount || 0) * (sp.distribution_percentage || 25) / 100),
        net_amount: sp.net_amount || 0,
        title_name: sp.content?.title_name,
        channel: sp.platform || '',
        content: sp.content,
        created_at: sp.created_at,
        updated_at: sp.updated_at
      }));

      setPayments(transformedPayments as any);
    } catch (error) {
      console.error('Error fetching payment history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center">
            <DollarSign className="h-5 w-5 mr-2" />
            Payment History ({payments.length})
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Channel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Gross Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Dist. Fee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Your Share
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {payment.content?.title_name || payment.title_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {payment.channel || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${payment.gross_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      -${payment.distribution_fee.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      ${payment.net_amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Gross:</span>
                  <div className="text-lg font-semibold text-gray-900">
                    ${payments.reduce((sum, p) => sum + p.gross_amount, 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Total Fees:</span>
                  <div className="text-lg font-semibold text-red-600">
                    -${payments.reduce((sum, p) => sum + p.distribution_fee, 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Total Net:</span>
                  <div className="text-lg font-semibold text-green-600">
                    ${payments.reduce((sum, p) => sum + p.net_amount, 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No payments yet</h3>
            <p className="text-gray-500">Payment history will appear here once payments are processed</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
