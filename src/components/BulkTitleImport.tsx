import React, { useState } from 'react';
import { Upload, X, Plus, Check } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Input } from './ui/Input';
import { supabase } from '../lib/supabase';

interface BulkTitleImportProps {
  onClose: () => void;
  onComplete: () => void;
}

export function BulkTitleImport({ onClose, onComplete }: BulkTitleImportProps) {
  const [titleNames, setTitleNames] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: string[]; errors: string[] } | null>(null);

  const handleImport = async () => {
    const names = titleNames
      .split('\n')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    if (names.length === 0) {
      alert('Please enter at least one title name');
      return;
    }

    setImporting(true);
    const success: string[] = [];
    const errors: string[] = [];

    try {
      for (const titleName of names) {
        try {
          const { data: existing } = await supabase!
            .from('content')
            .select('id, title_name')
            .ilike('title_name', titleName)
            .maybeSingle();

          if (existing) {
            errors.push(`${titleName} - Already exists`);
            continue;
          }

          const { error: insertError } = await supabase!
            .from('content')
            .insert({
              title_name: titleName,
              content_type: 'movie',
              status: 'approved',
              revenue_total: 0,
              distribution_fee: 0,
              expenses_total: 0,
              net_revenue: 0,
            });

          if (insertError) {
            errors.push(`${titleName} - ${insertError.message}`);
          } else {
            success.push(titleName);
          }
        } catch (err) {
          errors.push(`${titleName} - ${err.message}`);
        }
      }

      setResults({ success, errors });
    } catch (error) {
      console.error('Error during bulk import:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleComplete = () => {
    onComplete();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              Bulk Import Titles
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          {!results ? (
            <>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Instructions</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Enter one title per line</li>
                    <li>• Titles will be created as: Type=Movie, Status=Approved</li>
                    <li>• Duplicate titles will be skipped</li>
                    <li>• You can assign filmmakers later</li>
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title Names (one per line)
                  </label>
                  <textarea
                    value={titleNames}
                    onChange={(e) => setTitleNames(e.target.value)}
                    rows={15}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    placeholder="Enter title names, one per line..."
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {titleNames.split('\n').filter((n) => n.trim()).length} titles entered
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Importing...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Import Titles
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-green-900 mb-2 flex items-center">
                    <Check className="h-4 w-4 mr-2" />
                    Successfully Imported ({results.success.length})
                  </h4>
                  {results.success.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto">
                      <ul className="text-sm text-green-800 space-y-1">
                        {results.success.map((title, idx) => (
                          <li key={idx}>✓ {title}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-green-800">No titles imported</p>
                  )}
                </div>

                {results.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-red-900 mb-2 flex items-center">
                      <X className="h-4 w-4 mr-2" />
                      Errors ({results.errors.length})
                    </h4>
                    <div className="max-h-60 overflow-y-auto">
                      <ul className="text-sm text-red-800 space-y-1">
                        {results.errors.map((error, idx) => (
                          <li key={idx}>✗ {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <Button onClick={handleComplete}>Done</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
