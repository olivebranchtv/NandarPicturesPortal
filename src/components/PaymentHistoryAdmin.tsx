import React, { useState, useEffect } from 'react';
import { DollarSign, CreditCard as Edit, Trash2, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { supabase, Payment, Content } from '../lib/supabase';

interface PaymentHistoryAdminProps {
  onUpdate: () => void;
}

export function PaymentHistoryAdmin({ onUpdate }: PaymentHistoryAdminProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [titles, setTitles] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editData, setEditData] = useState({
    payment_date: '',
    gross_amount: '',
    channel: '',
    notes: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const rowsPerPage = 100;

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      // Fetch all payments in batches to bypass Supabase 1000 row limit
      let allPayments: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      console.log('Starting to fetch all payments...');

      while (hasMore) {
        const { data, error } = await supabase!
          .from('payments')
          .select(
            `
            *,
            content:content_id(title_name),
            filmmaker:filmmaker_id(first_name, last_name, email)
          `
          )
          .order('payment_date', { ascending: false })
          .range(from, from + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allPayments = [...allPayments, ...data];
          console.log(`Fetched batch: ${data.length} payments (total so far: ${allPayments.length})`);
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`✅ Fetched ALL ${allPayments.length} payments from database`);
      setPayments(allPayments);

      // Fetch titles
      const { data: titlesData, error: titlesError } = await supabase!.from('content').select('*');
      if (titlesError) throw titlesError;
      setTitles(titlesData || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (payment: Payment) => {
    setEditingPayment(payment);
    setEditData({
      payment_date: payment.payment_date,
      gross_amount: payment.gross_amount.toString(),
      channel: payment.channel || '',
      notes: payment.notes || '',
    });
    setShowEditModal(true);
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment || !editData.payment_date || !editData.gross_amount) {
      alert('Please fill in required fields');
      return;
    }

    try {
      const grossAmount = parseFloat(editData.gross_amount);
      const distributionFee = grossAmount * 0.25;
      const netAmount = grossAmount - distributionFee;

      const { error } = await supabase!
        .from('payments')
        .update({
          payment_date: editData.payment_date,
          gross_amount: grossAmount,
          distribution_fee: distributionFee,
          net_amount: netAmount,
          channel: editData.channel || null,
          notes: editData.notes || null,
        })
        .eq('id', editingPayment.id);

      if (error) throw error;

      alert('Payment updated successfully!');
      setShowEditModal(false);
      setEditingPayment(null);
      fetchPayments();
      onUpdate();
    } catch (error) {
      console.error('Error updating payment:', error);
      alert(`Error updating payment: ${error.message}`);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase!
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;

      alert('Payment deleted successfully!');
      fetchPayments();
      onUpdate();
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert(`Error deleting payment: ${error.message}`);
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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              Payment History ({payments.length} total)
            </h3>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Search by title, channel, filmmaker..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-64"
              />
            </div>
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
                      Filmmaker
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Channel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Gross Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Dist. Fee (25%)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Net to Filmmaker
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments
                    .filter(payment => {
                      if (!searchTerm) return true;
                      const search = searchTerm.toLowerCase();
                      return (
                        payment.content?.title_name?.toLowerCase().includes(search) ||
                        payment.title_name?.toLowerCase().includes(search) ||
                        payment.channel?.toLowerCase().includes(search) ||
                        payment.filmmaker?.email?.toLowerCase().includes(search) ||
                        payment.filmmaker?.first_name?.toLowerCase().includes(search) ||
                        payment.filmmaker?.last_name?.toLowerCase().includes(search)
                      );
                    })
                    .slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
                    .map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {payment.content?.title_name || payment.title_name || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {payment.filmmaker ? (
                            <div>
                              <div>
                                {payment.filmmaker.first_name} {payment.filmmaker.last_name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {payment.filmmaker.email}
                              </div>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {payment.channel || '-'}
                        </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${payment.gross_amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        -${payment.distribution_fee.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        ${payment.net_amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                            payment.payment_method === 'excel_upload'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {payment.payment_method === 'excel_upload' ? 'Excel' : 'Manual'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleEditClick(payment)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDeletePayment(payment.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Controls */}
              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <div className="text-sm text-gray-700">
                  Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, payments.filter(payment => {
                    if (!searchTerm) return true;
                    const search = searchTerm.toLowerCase();
                    return (
                      payment.content?.title_name?.toLowerCase().includes(search) ||
                      payment.title_name?.toLowerCase().includes(search) ||
                      payment.channel?.toLowerCase().includes(search) ||
                      payment.filmmaker?.email?.toLowerCase().includes(search) ||
                      payment.filmmaker?.first_name?.toLowerCase().includes(search) ||
                      payment.filmmaker?.last_name?.toLowerCase().includes(search)
                    );
                  }).length)} of {payments.filter(payment => {
                    if (!searchTerm) return true;
                    const search = searchTerm.toLowerCase();
                    return (
                      payment.content?.title_name?.toLowerCase().includes(search) ||
                      payment.title_name?.toLowerCase().includes(search) ||
                      payment.channel?.toLowerCase().includes(search) ||
                      payment.filmmaker?.email?.toLowerCase().includes(search) ||
                      payment.filmmaker?.first_name?.toLowerCase().includes(search) ||
                      payment.filmmaker?.last_name?.toLowerCase().includes(search)
                    );
                  }).length} payments
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="px-4 py-2 text-sm text-gray-700">
                    Page {currentPage} of {Math.ceil(payments.filter(payment => {
                      if (!searchTerm) return true;
                      const search = searchTerm.toLowerCase();
                      return (
                        payment.content?.title_name?.toLowerCase().includes(search) ||
                        payment.title_name?.toLowerCase().includes(search) ||
                        payment.channel?.toLowerCase().includes(search) ||
                        payment.filmmaker?.email?.toLowerCase().includes(search) ||
                        payment.filmmaker?.first_name?.toLowerCase().includes(search) ||
                        payment.filmmaker?.last_name?.toLowerCase().includes(search)
                      );
                    }).length / rowsPerPage)}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage >= Math.ceil(payments.filter(payment => {
                      if (!searchTerm) return true;
                      const search = searchTerm.toLowerCase();
                      return (
                        payment.content?.title_name?.toLowerCase().includes(search) ||
                        payment.title_name?.toLowerCase().includes(search) ||
                        payment.channel?.toLowerCase().includes(search) ||
                        payment.filmmaker?.email?.toLowerCase().includes(search) ||
                        payment.filmmaker?.first_name?.toLowerCase().includes(search) ||
                        payment.filmmaker?.last_name?.toLowerCase().includes(search)
                      );
                    }).length / rowsPerPage)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No payments yet</h3>
              <p className="text-gray-500">Upload a payment file or add payments manually</p>
            </div>
          )}
        </CardContent>
      </Card>

      {showEditModal && editingPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Edit Payment</h3>
              <div className="space-y-4">
                <Input
                  label="Payment Date"
                  type="date"
                  value={editData.payment_date}
                  onChange={(e) =>
                    setEditData({ ...editData, payment_date: e.target.value })
                  }
                />
                <Input
                  label="Gross Amount"
                  type="number"
                  value={editData.gross_amount}
                  onChange={(e) =>
                    setEditData({ ...editData, gross_amount: e.target.value })
                  }
                  placeholder="1000.00"
                />
                <Input
                  label="Channel"
                  value={editData.channel}
                  onChange={(e) => setEditData({ ...editData, channel: e.target.value })}
                  placeholder="e.g., Netflix, Amazon Prime"
                />
                <Input
                  label="Notes"
                  value={editData.notes}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  placeholder="Additional notes"
                />
                <div className="p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">Distribution Fee (25%):</span>
                    <span className="font-medium text-red-600">
                      -$
                      {editData.gross_amount
                        ? (parseFloat(editData.gross_amount) * 0.25).toLocaleString()
                        : '0'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Net to Filmmaker:</span>
                    <span className="font-medium text-green-600">
                      $
                      {editData.gross_amount
                        ? (parseFloat(editData.gross_amount) * 0.75).toLocaleString()
                        : '0'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingPayment(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleUpdatePayment}>Update Payment</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
