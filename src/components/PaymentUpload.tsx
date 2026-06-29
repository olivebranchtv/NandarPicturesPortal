import React, { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader } from './ui/Card';
import { parsePaymentFile, ParsedPaymentRow } from '../lib/fileParser';
import { findBestMatch } from '../lib/fuzzyMatch';
import { supabase, Content } from '../lib/supabase';
import { roundToTwoDecimals, calculateDistributionFee, calculateNetAmount } from '../lib/formatters';

const MAX_FILE_SIZE_MB = 10;

interface PaymentUploadProps {
  onUploadComplete: () => void;
  onClose: () => void;
  titles: Content[];
  adminId: string;
}

interface ProcessedRow extends ParsedPaymentRow {
  matchedContentId?: string;
  matchedTitle?: string;
  matchScore?: number;
  error?: string;
}

export function PaymentUpload({ onUploadComplete, onClose, titles, adminId }: PaymentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsedRows, setParsedRows] = useState<ProcessedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
        e.target.value = '';
        return;
      }
      setFile(selectedFile);
      setParsedRows([]);
      setErrors([]);
      setShowPreview(false);
    }
  };

  const handleParseFile = async () => {
    if (!file) return;

    setParsing(true);
    setErrors([]);

    try {
      const result = await parsePaymentFile(file);

      if (!result.success) {
        setErrors(result.errors);
        setParsing(false);
        return;
      }

      const processedRows: ProcessedRow[] = result.data
        .filter((row) => row.grossAmount !== 0)
        .filter((row) => {
          // Skip rows where title name (Column D) is empty
          const hasTitle = row.titleName && row.titleName.trim() !== '';
          if (!hasTitle) {
            console.log(`Skipping row - no title name in Column D`);
          }
          return hasTitle;
        })
        .map((row) => {
          let titleName = row.titleName;

          // Only try to match if we have an original title name
          const match = findBestMatch(
            titleName,
            titles,
            (content) => content.title_name,
            0.7
          );

          if (match) {
            return {
              ...row,
              titleName,
              matchedContentId: match.item.id,
              matchedTitle: match.item.title_name,
              matchScore: match.score,
            };
          }

          return {
            ...row,
            titleName,
            error: 'No matching title found',
          };
        });

      setParsedRows(processedRows);
      setErrors(result.errors);
      setShowPreview(true);
    } catch (error) {
      console.error('Error parsing file:', error);
      setErrors([`Failed to parse file: ${error.message}`]);
    } finally {
      setParsing(false);
    }
  };

  const handleUploadPayments = async () => {
    if (parsedRows.length === 0) return;

    setUploading(true);

    try {
      const matchedRows = parsedRows.filter((row) => row.matchedContentId);
      const unmatchedRows = parsedRows.filter((row) => !row.matchedContentId);

      // Process matched rows in batches of 500
      if (matchedRows.length > 0) {
        const paymentsToInsert = matchedRows.map((row) => {
          const content = titles.find((t) => t.id === row.matchedContentId);
          const grossAmount = roundToTwoDecimals(row.grossAmount);
          const distributionFee = calculateDistributionFee(grossAmount);
          const netAmount = calculateNetAmount(grossAmount);

          const paymentRecord = {
            content_id: row.matchedContentId,
            filmmaker_id: content?.filmmaker_id || null,
            payment_date: row.paymentDate,
            gross_amount: grossAmount,
            distribution_fee: distributionFee,
            net_amount: netAmount,
            channel: row.channel || null,
            title_name: row.titleName,
            payment_method: 'excel_upload' as const,
          };

          console.log('🔍 MATCHED PAYMENT RECORD TO INSERT:', {
            title: row.titleName,
            paymentDate: row.paymentDate,
            channel: row.channel,
            'ACTUAL RECORD': paymentRecord
          });

          return paymentRecord;
        });

        // Insert in batches of 500
        const batchSize = 500;
        for (let i = 0; i < paymentsToInsert.length; i += batchSize) {
          const batch = paymentsToInsert.slice(i, i + batchSize);
          console.log(`Inserting batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(paymentsToInsert.length / batchSize)}`);

          const { error: paymentsError } = await supabase!
            .from('payments')
            .insert(batch);

          if (paymentsError) {
            console.error('Error inserting payments batch:', paymentsError);
            throw new Error(`Failed to insert payments batch: ${paymentsError.message}`);
          }
        }
      }

      // Auto-create titles for unmatched rows and add to unassigned_content
      if (unmatchedRows.length > 0) {
        const batchSize = 500;
        const allCreatedTitles = [];

        // Create titles in batches
        const titlesToCreate = unmatchedRows.map((row) => ({
          title_name: row.titleName,
          content_type: 'movie' as const,
          filmmaker_id: null,
          status: 'approved' as const,
          created_at: new Date().toISOString(),
        }));

        for (let i = 0; i < titlesToCreate.length; i += batchSize) {
          const batch = titlesToCreate.slice(i, i + batchSize);
          console.log(`Creating titles batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(titlesToCreate.length / batchSize)}`);

          const { data: createdTitles, error: titlesError } = await supabase!
            .from('content')
            .insert(batch)
            .select();

          if (titlesError) {
            console.error('Error creating titles:', titlesError);
            throw new Error(`Failed to create titles: ${titlesError.message}`);
          }

          if (createdTitles) {
            allCreatedTitles.push(...createdTitles);
          }
        }

        // Now insert payments for these newly created titles in batches
        if (allCreatedTitles.length > 0) {
          const newPayments = unmatchedRows.map((row, index) => {
            const grossAmount = roundToTwoDecimals(row.grossAmount);
            const distributionFee = calculateDistributionFee(grossAmount);
            const netAmount = calculateNetAmount(grossAmount);

            const paymentRecord = {
              content_id: allCreatedTitles[index].id,
              payment_date: row.paymentDate,
              gross_amount: grossAmount,
              distribution_fee: distributionFee,
              net_amount: netAmount,
              channel: row.channel || null,
              title_name: row.titleName,
              payment_method: 'excel_upload' as const,
            };

            console.log('🔍 UNMATCHED PAYMENT RECORD TO INSERT:', {
              title: row.titleName,
              paymentDate: row.paymentDate,
              channel: row.channel,
              'ACTUAL RECORD': paymentRecord
            });

            return paymentRecord;
          });

          for (let i = 0; i < newPayments.length; i += batchSize) {
            const batch = newPayments.slice(i, i + batchSize);
            console.log(`Inserting new payments batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(newPayments.length / batchSize)}`);

            const { error: newPaymentsError } = await supabase!
              .from('payments')
              .insert(batch);

            if (newPaymentsError) {
              console.error('Error inserting new payments:', newPaymentsError);
              throw new Error(`Failed to insert new payments: ${newPaymentsError.message}`);
            }
          }
        }

        // Also add to unassigned_content for admin to assign filmmaker in batches
        const unassignedToInsert = unmatchedRows.map((row) => ({
          title_name: row.titleName,
          payment_date: row.paymentDate,
          gross_amount: roundToTwoDecimals(row.grossAmount),
          channel: row.channel || null,
          status: 'pending' as const,
          created_by: adminId,
        }));

        for (let i = 0; i < unassignedToInsert.length; i += batchSize) {
          const batch = unassignedToInsert.slice(i, i + batchSize);
          console.log(`Inserting unassigned content batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(unassignedToInsert.length / batchSize)}`);

          const { error: unassignedError } = await supabase!
            .from('unassigned_content')
            .insert(batch);

          if (unassignedError) {
            console.error('Error inserting unassigned content:', unassignedError);
            throw new Error(`Failed to insert unassigned content: ${unassignedError.message}`);
          }
        }
      }

      alert(
        `Upload complete!\n${matchedRows.length} payments matched to existing titles\n${unmatchedRows.length} new titles created and need filmmaker assignment`
      );

      onUploadComplete();
      onClose();
    } catch (error) {
      console.error('Error uploading payments:', error);
      alert(`Error uploading payments: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <FileSpreadsheet className="h-5 w-5 mr-2" />
              Upload Payment File
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="flex flex-col items-center justify-center">
                <Upload className="h-12 w-12 text-gray-400 mb-4" />
                <label className="cursor-pointer">
                  <span className="text-blue-600 hover:text-blue-700 font-medium">
                    Choose file
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">
                  Excel (.xlsx, .xls) or CSV files
                </p>
                {file && (
                  <p className="text-sm text-gray-700 mt-2 font-medium">
                    Selected: {file.name}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">File Format Requirements</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>Column A: Payment Date</li>
                <li>Column B: Net Amount</li>
                <li>Column C: Channel/Outlet</li>
                <li>Column D: Title Name</li>
              </ul>
              <p className="text-xs text-blue-700 mt-2">
                25% distribution fee will be automatically calculated
              </p>
            </div>

            {errors.length > 0 && (
              <Card>
                <CardHeader>
                  <h4 className="text-sm font-medium text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Parsing Errors
                  </h4>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-red-700 space-y-1">
                    {errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {showPreview && parsedRows.length > 0 && (
              <Card>
                <CardHeader>
                  <h4 className="text-sm font-medium text-gray-900">
                    Preview ({parsedRows.length} rows)
                  </h4>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Amount</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Channel</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Title (Excel)</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Matched Title</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {parsedRows.map((row, idx) => (
                          <tr key={idx} className={row.error ? 'bg-yellow-50' : ''}>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                              {row.paymentDate}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                              ${row.grossAmount.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {row.channel || '-'}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {row.titleName}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {row.matchedTitle ? (
                                <div>
                                  {row.matchedTitle}
                                  {row.matchScore && row.matchScore < 1 && (
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({Math.round(row.matchScore * 100)}% match)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-yellow-600">Will be created</span>
                              )}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {row.error ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Unmatched
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Matched
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Matched:</span>{' '}
                        <span className="text-green-600">
                          {parsedRows.filter((r) => !r.error).length}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Unmatched:</span>{' '}
                        <span className="text-yellow-600">
                          {parsedRows.filter((r) => r.error).length}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {!showPreview ? (
              <Button
                onClick={handleParseFile}
                disabled={!file || parsing}
              >
                {parsing ? 'Parsing...' : 'Parse File'}
              </Button>
            ) : (
              <Button
                onClick={handleUploadPayments}
                disabled={uploading || parsedRows.length === 0}
              >
                {uploading ? 'Uploading...' : `Upload ${parsedRows.length} Payments`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
