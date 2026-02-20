import React, { useState, useEffect } from 'react';
import { Film, User, ArrowRight, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { supabase, Content, User as UserType } from '../lib/supabase';

interface TitleReassignmentProps {
  onUpdate: () => void;
}

export function TitleReassignment({ onUpdate }: TitleReassignmentProps) {
  const [titles, setTitles] = useState<Content[]>([]);
  const [filmmakers, setFilmmakers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState<Content | null>(null);
  const [selectedFilmmaker, setSelectedFilmmaker] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [titlesRes, filmmakersRes] = await Promise.all([
        supabase!
          .from('content')
          .select('*')
          .order('title_name'),
        supabase!
          .from('users')
          .select('*')
          .eq('role', 'filmmaker')
          .order('first_name'),
      ]);

      if (titlesRes.error) throw titlesRes.error;
      if (filmmakersRes.error) throw filmmakersRes.error;

      setTitles(titlesRes.data || []);
      setFilmmakers(filmmakersRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilmmakerName = (filmakerId: string) => {
    const filmmaker = filmmakers.find(f => f.id === filmakerId);
    return filmmaker ? `${filmmaker.first_name} ${filmmaker.last_name}` : 'Unknown';
  };

  const handleReassignClick = (title: Content) => {
    setSelectedTitle(title);
    setSelectedFilmmaker('');
    setShowReassignModal(true);
  };

  const handleReassign = async () => {
    if (!selectedTitle || !selectedFilmmaker) {
      alert('Please select a filmmaker');
      return;
    }

    if (selectedTitle.filmmaker_id === selectedFilmmaker) {
      alert('Please select a different filmmaker');
      return;
    }

    try {
      const { error } = await supabase!
        .from('content')
        .update({ filmmaker_id: selectedFilmmaker })
        .eq('id', selectedTitle.id);

      if (error) throw error;

      alert('Title reassigned successfully!');
      setShowReassignModal(false);
      setSelectedTitle(null);
      setSelectedFilmmaker('');
      setSearchTerm('');
      fetchData();
      onUpdate();
    } catch (error) {
      console.error('Error reassigning title:', error);
      alert(`Error reassigning title: ${error.message}`);
    }
  };

  const handleUnassign = async (titleId: string) => {
    if (!confirm('Are you sure you want to unassign this title? It will have no filmmaker assigned.')) {
      return;
    }

    try {
      const { error } = await supabase!
        .from('content')
        .update({ filmmaker_id: null })
        .eq('id', titleId);

      if (error) throw error;

      alert('Title unassigned successfully!');
      fetchData();
      onUpdate();
    } catch (error) {
      console.error('Error unassigning title:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const filteredTitles = titles.filter(title =>
    title.title_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getFilmmakerName(title.filmmaker_id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <ArrowRight className="h-5 w-5 mr-2 text-blue-600" />
              Title Reassignment ({filteredTitles.length})
            </h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search titles or filmmakers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Current Filmmaker
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTitles.map((title) => (
                  <tr key={title.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {title.title_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm capitalize text-gray-500">
                      {title.content_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {title.filmmaker_id ? getFilmmakerName(title.filmmaker_id) : (
                        <span className="text-red-600 font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        title.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : title.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {title.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handleReassignClick(title)}
                        >
                          <User className="h-3 w-3 mr-1" />
                          Reassign
                        </Button>
                        {title.filmmaker_id && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleUnassign(title.id)}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Unassign
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredTitles.length === 0 && (
            <div className="text-center py-8">
              <Film className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">No titles found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {showReassignModal && selectedTitle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Reassign: {selectedTitle.title_name}
              </h3>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="mb-3">
                  <p className="text-xs text-gray-500">Current Filmmaker</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedTitle.filmmaker_id ? getFilmmakerName(selectedTitle.filmmaker_id) : 'Unassigned'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Type</p>
                  <p className="text-sm font-semibold capitalize text-gray-900">{selectedTitle.content_type}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select New Filmmaker
                </label>
                <select
                  value={selectedFilmmaker}
                  onChange={(e) => setSelectedFilmmaker(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Choose a filmmaker...</option>
                  {filmmakers.map((filmmaker) => (
                    <option key={filmmaker.id} value={filmmaker.id}>
                      {filmmaker.first_name} {filmmaker.last_name} ({filmmaker.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowReassignModal(false);
                    setSelectedTitle(null);
                    setSelectedFilmmaker('');
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleReassign}>
                  <Check className="h-4 w-4 mr-2" />
                  Reassign
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
