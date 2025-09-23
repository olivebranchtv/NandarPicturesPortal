import React, { useState } from 'react';
import { Edit, Trash2, DollarSign, Calendar, Building } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { supabase, StreamingPayment, Content, User } from '../lib/supabase';

interface PaymentHistoryTableProps {
  streamingPayments: StreamingPayment[];
  titles: Content[];
  filmmakers: User[];
  refreshData: () => void;
}

export function PaymentHistoryTable({ 
  streamingPayments, 
  titles, 
  filmmakers, 
  refreshData 
}: PaymentHistoryTableProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<StreamingPayment | null>(null);
  const [editPaymentData, setEditPaymentData] = useState({
    platform: '',
    outlet: '',
    payment_date: '',
    gross_amount: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const handleEditPayment = (payment: StreamingPayment) => {
    setEditingPayment(payment);
    setEditPaymentData({
      platform: payment.platform || '',
      outlet: payment.outlet || '',
      payment_date: payment.payment_date || '',
      gross_amount: payment.gross_amount?.toString() || '',
      notes: payment.notes || '',
    });
    setShowEditModal(true);
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment || !editPaymentData.platform || !editPaymentData.payment_date || !editPaymentData.gross_amount) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      // Get the title's distribution settings to calculate net amount
      const { data: titleData, error: titleError } = await supabase
        .from('content')
        .select(`
          *,
          title_distribution_settings(*)
        `)
        .eq('id', editingPayment.title_id)
        .single();

      if (titleError) throw titleError;

      // Use the title's distribution percentage, default to 50% if not set
      const distributionPercentage = titleData.title_distribution_settings?.[0]?.company_percentage || 50;
      const grossAmount = parseFloat(editPaymentData.gross_amount);
      const netAmount = grossAmount * ((100 - distributionPercentage) / 100);

      const { error } = await supabase
        .from('streaming_payments')
        .update({
          platform: editPaymentData.platform,
          outlet: editPaymentData.outlet || null,
          payment_date: editPaymentData.payment_date,
          gross_amount: grossAmount,
          net_amount: netAmount,
          distribution_percentage: distributionPercentage,
          notes: editPaymentData.notes || null,
        })
        .eq('id', editingPayment.id);

      if (error) throw error;

      alert('Payment updated successfully!');
      setShowEditModal(false);
      setEditingPayment(null);
      refreshData();
    } catch (error) {
      console.error('Error updating payment:', error);
      alert('Error updating payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId: string, titleName: string) => {
    if (!confirm(`Are you sure you want to delete this payment for "${titleName}"? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('streaming_payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;

      alert('Payment deleted successfully!');
      refreshData();
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Error deleting payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTitleName = (titleId: string) => {
    const title = titles.find(t => t.id === titleId);
    return title?.title_name || 'Unknown Title';
  };

  const getFilmmakerName = (titleId: string) => {
    const title = titles.find(t => t.id === titleId);
    if (!title?.filmmaker_id) return 'Unknown Filmmaker';
    
    const filmmaker = filmmakers.find(f => f.id === title.filmmaker_id);
    return filmmaker ? `${filmmaker.first_name} ${filmmaker.last_name}` : 'Unknown Filmmaker';
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              Payment Transaction History
            </h3>
            <div className="text-sm text-gray-500">
              {streamingPayments.length} transaction{streamingPayments.length !== 1 ? 's' : ''}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {streamingPayments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Filmmaker
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Platform
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gross Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Net Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Distribution
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {streamingPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {getTitleName(payment.title_id)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getFilmmakerName(payment.title_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Building className="h-4 w-4 mr-2 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {payment.platform}
                            </div>
                            {payment.outlet && (
                              <div className="text-xs text-gray-500">
                                {payment.outlet}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${payment.gross_amount?.toLocaleString() || '0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${payment.net_amount?.toLocaleString() || '0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {payment.distribution_percentage || 50}% / {100 - (payment.distribution_percentage || 50)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {payment.notes || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleEditPayment(payment)}
                            disabled={loading}
                            className="flex items-center space-x-1"
                          >
                            <Edit className="h-3 w-3" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDeletePayment(payment.id, getTitleName(payment.title_id))}
                            disabled={loading}
                            className="flex items-center space-x-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Delete</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No payment transactions yet</h3>
              <p className="text-gray-500">
                Payment transactions will appear here once they are added to the system
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Payment Modal */}
      {showEditModal && editingPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Edit Payment - {getTitleName(editingPayment.title_id)}
              </h3>
              <div className="space-y-4">
                <Input
                  label="Platform *"
                  value={editPaymentData.platform}
                  onChange={(e) => setEditPaymentData({ ...editPaymentData, platform: e.target.value })}
                  placeholder="Netflix, Amazon Prime, etc."
                />
                <Input
                  label="Outlet (Optional)"
                  value={editPaymentData.outlet}
                  onChange={(e) => setEditPaymentData({ ...editPaymentData, outlet: e.target.value })}
                  placeholder="Specific outlet or region"
                />
                <Input
                  label="Payment Date *"
                  type="date"
                  value={editPaymentData.payment_date}
                  onChange={(e) => setEditPaymentData({ ...editPaymentData, payment_date: e.target.value })}
                />
                <Input
                  label="Gross Amount *"
                  type="number"
                  step="0.01"
                  value={editPaymentData.gross_amount}
                  onChange={(e) => setEditPaymentData({ ...editPaymentData, gross_amount: e.target.value })}
                  placeholder="1000.00"
                />
                <Input
                  label="Notes (Optional)"
                  value={editPaymentData.notes}
                  onChange={(e) => setEditPaymentData({ ...editPaymentData, notes: e.target.value })}
                  placeholder="Additional notes about this payment"
                />
                <div className="bg-blue-50 p-3 rounded-md">
                  <p className="text-sm text-blue-800">
                    Net amount will be automatically calculated based on the title's distribution settings.
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingPayment(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdatePayment}
                  disabled={loading}
                >
                  {loading ? 'Updating...' : 'Update Payment'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}