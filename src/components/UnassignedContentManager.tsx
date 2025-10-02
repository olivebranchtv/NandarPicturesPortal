import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, X, CreditCard as Edit } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { supabase, UnassignedContent, Content, User } from '../lib/supabase';
import { roundToTwoDecimals, calculateDistributionFee, calculateNetAmount } from '../lib/formatters';

interface UnassignedContentManagerProps {
  onUpdate: () => void;
}

export function UnassignedContentManager({ onUpdate }: UnassignedContentManagerProps) {
  const [unassignedItems, setUnassignedItems] = useState<UnassignedContent[]>([]);
  const [titles, setTitles] = useState<Content[]>([]);
  const [filmmakers, setFilmmakers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UnassignedContent | null>(null);
  const [assignMode, setAssignMode] = useState<'existing' | 'new'>('existing');
  const [selectedTitleId, setSelectedTitleId] = useState('');
  const [newTitleData, setNewTitleData] = useState({
    title_name: '',
    filmmaker_id: '',
    content_type: 'movie' as 'movie' | 'series' | 'episode',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [unassignedRes, titlesRes, filmmakersRes] = await Promise.all([
        supabase!
          .from('unassigned_content')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase!.from('content').select('*').order('title_name'),
        supabase!
          .from('users')
          .select('*')
          .eq('role', 'filmmaker')
          .order('first_name'),
      ]);

      if (unassignedRes.error) throw unassignedRes.error;
      if (titlesRes.error) throw titlesRes.error;
      if (filmmakersRes.error) throw filmmakersRes.error;

      setUnassignedItems(unassignedRes.data || []);
      setTitles(titlesRes.data || []);
      setFilmmakers(filmmakersRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignClick = (item: UnassignedContent) => {
    setSelectedItem(item);
    setNewTitleData({
      title_name: item.title_name,
      filmmaker_id: '',
      content_type: 'movie',
    });
    setShowAssignModal(true);
  };

  const handleAssignToExisting = async () => {
    if (!selectedItem || !selectedTitleId) {
      alert('Please select a title');
      return;
    }

    try {
      const title = titles.find((t) => t.id === selectedTitleId);
      if (!title) {
        alert('Title not found');
        return;
      }

      const grossAmount = roundToTwoDecimals(selectedItem.gross_amount);
      const distributionFee = calculateDistributionFee(grossAmount);
      const netAmount = calculateNetAmount(grossAmount);

      const { error: paymentError } = await supabase!.from('payments').insert({
        content_id: selectedTitleId,
        filmmaker_id: title.filmmaker_id,
        payment_date: selectedItem.payment_date,
        gross_amount: grossAmount,
        distribution_fee: distributionFee,
        net_amount: netAmount,
        channel: selectedItem.channel,
        title_name: selectedItem.title_name,
        payment_method: 'excel_upload',
      });

      if (paymentError) throw paymentError;

      const { error: updateError } = await supabase!
        .from('unassigned_content')
        .update({
          status: 'assigned',
          assigned_content_id: selectedTitleId,
        })
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      alert('Payment assigned successfully!');
      setShowAssignModal(false);
      setSelectedItem(null);
      setSelectedTitleId('');
      fetchData();
      onUpdate();
    } catch (error) {
      console.error('Error assigning payment:', error);
      alert(`Error assigning payment: ${error.message}`);
    }
  };

  const handleCreateNewTitle = async () => {
    if (!selectedItem || !newTitleData.title_name || !newTitleData.filmmaker_id) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const { data: newTitle, error: titleError } = await supabase!
        .from('content')
        .insert({
          title_name: newTitleData.title_name,
          content_type: newTitleData.content_type,
          filmmaker_id: newTitleData.filmmaker_id,
          status: 'approved',
        })
        .select()
        .single();

      if (titleError) throw titleError;

      const { error: distributionError } = await supabase!
        .from('title_distribution_settings')
        .insert({
          title_id: newTitle.id,
          company_percentage: 25,
          filmmaker_percentage: 75,
        });

      if (distributionError) {
        console.error('Error creating distribution settings:', distributionError);
      }

      const grossAmount = roundToTwoDecimals(selectedItem.gross_amount);
      const distributionFee = calculateDistributionFee(grossAmount);
      const netAmount = calculateNetAmount(grossAmount);

      const { error: paymentError } = await supabase!.from('payments').insert({
        content_id: newTitle.id,
        filmmaker_id: newTitleData.filmmaker_id,
        payment_date: selectedItem.payment_date,
        gross_amount: grossAmount,
        distribution_fee: distributionFee,
        net_amount: netAmount,
        channel: selectedItem.channel,
        title_name: selectedItem.title_name,
        payment_method: 'excel_upload',
      });

      if (paymentError) throw paymentError;

      const { error: updateError } = await supabase!
        .from('unassigned_content')
        .update({
          status: 'assigned',
          assigned_content_id: newTitle.id,
        })
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      alert('New title created and payment assigned successfully!');
      setShowAssignModal(false);
      setSelectedItem(null);
      setNewTitleData({
        title_name: '',
        filmmaker_id: '',
        content_type: 'movie',
      });
      fetchData();
      onUpdate();
    } catch (error) {
      console.error('Error creating title:', error);
      alert(`Error creating title: ${error.message}`);
    }
  };

  const handleIgnore = async (itemId: string) => {
    if (!confirm('Are you sure you want to ignore this payment?')) {
      return;
    }

    try {
      const { error } = await supabase!
        .from('unassigned_content')
        .update({ status: 'ignored' })
        .eq('id', itemId);

      if (error) throw error;

      alert('Payment marked as ignored');
      fetchData();
    } catch (error) {
      console.error('Error ignoring payment:', error);
      alert(`Error: ${error.message}`);
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

  if (unassignedItems.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-yellow-600" />
              Unassigned Payments ({unassignedItems.length})
            </h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Title Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Channel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {unassignedItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.title_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(item.payment_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${item.gross_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.channel || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handleAssignClick(item)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Assign
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleIgnore(item.id)}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Ignore
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showAssignModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Assign Payment: {selectedItem.title_name}
              </h3>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Amount:</span>{' '}
                    ${selectedItem.gross_amount.toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Date:</span>{' '}
                    {new Date(selectedItem.payment_date).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Channel:</span>{' '}
                    {selectedItem.channel || '-'}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Net to Filmmaker:</span>{' '}
                    ${(selectedItem.gross_amount * 0.75).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex space-x-2 mb-4">
                <button
                  onClick={() => setAssignMode('existing')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                    assignMode === 'existing'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Assign to Existing Title
                </button>
                <button
                  onClick={() => setAssignMode('new')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                    assignMode === 'new'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Create New Title
                </button>
              </div>

              {assignMode === 'existing' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Existing Title
                  </label>
                  <select
                    value={selectedTitleId}
                    onChange={(e) => setSelectedTitleId(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Choose a title...</option>
                    {titles.map((title) => (
                      <option key={title.id} value={title.id}>
                        {title.title_name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-4">
                  <Input
                    label="Title Name"
                    value={newTitleData.title_name}
                    onChange={(e) =>
                      setNewTitleData({ ...newTitleData, title_name: e.target.value })
                    }
                    placeholder="Enter title name"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Content Type
                    </label>
                    <select
                      value={newTitleData.content_type}
                      onChange={(e) =>
                        setNewTitleData({
                          ...newTitleData,
                          content_type: e.target.value as 'movie' | 'series' | 'episode',
                        })
                      }
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="movie">Movie</option>
                      <option value="series">Series</option>
                      <option value="episode">Episode</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Filmmaker
                    </label>
                    <select
                      value={newTitleData.filmmaker_id}
                      onChange={(e) =>
                        setNewTitleData({ ...newTitleData, filmmaker_id: e.target.value })
                      }
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a filmmaker...</option>
                      {filmmakers.map((filmmaker) => (
                        <option key={filmmaker.id} value={filmmaker.id}>
                          {filmmaker.first_name} {filmmaker.last_name} ({filmmaker.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedItem(null);
                    setSelectedTitleId('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={
                    assignMode === 'existing'
                      ? handleAssignToExisting
                      : handleCreateNewTitle
                  }
                >
                  <Check className="h-4 w-4 mr-2" />
                  {assignMode === 'existing' ? 'Assign Payment' : 'Create & Assign'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
