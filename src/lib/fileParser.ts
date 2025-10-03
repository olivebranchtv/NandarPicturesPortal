import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ParsedPaymentRow {
  paymentDate: string;
  grossAmount: number;
  channel: string;
  titleName: string;
  rowNumber: number;
}

export interface ParseResult {
  success: boolean;
  data: ParsedPaymentRow[];
  errors: string[];
}

function parseDate(dateValue: any): string {
  if (!dateValue) return '';

  if (typeof dateValue === 'number') {
    const date = XLSX.SSF.parse_date_code(dateValue);
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }

  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  return dateValue.toString();
}

function parseAmount(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) return null;
    return Math.round(value * 100) / 100;
  }

  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/[$,\s()]/g, '').replace(/[()]/g, '');

    if (cleaned === '' || cleaned === '-' || cleaned === 'N/A' || cleaned.toLowerCase() === 'n/a') return null;

    const isNegative = value.includes('(') && value.includes(')');
    const parsed = parseFloat(cleaned);

    if (isNaN(parsed) || !isFinite(parsed)) return null;

    const result = Math.round(parsed * 100) / 100;
    return isNegative ? -result : result;
  }

  return null;
}

export async function parseExcelFile(file: File): Promise<ParseResult> {
  const errors: string[] = [];
  const data: ParsedPaymentRow[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: true, defval: null });

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];

      if (!row || row.length === 0) {
        continue;
      }

      const hasData = row.some(cell => {
        return cell !== null && cell !== undefined && cell !== '' && cell !== ' ';
      });

      if (!hasData) {
        continue;
      }

      const paymentDate = parseDate(row[0]);
      const grossAmount = parseAmount(row[2]);
      const channel = row[6] ? String(row[6]).trim() : '';
      const titleName = row[7] ? String(row[7]).trim() : '';

      console.log(`Row ${i + 1} - Channel (col G):`, row[6], '| Title (col H):', row[7]);

      if (!titleName || titleName === '') {
        errors.push(`Row ${i + 1}: Missing title name (Column H is empty)`);
        continue;
      }

      if (!paymentDate || paymentDate === '') {
        errors.push(`Row ${i + 1}: Missing payment date (Column A is empty)`);
        continue;
      }

      if (grossAmount === null || isNaN(grossAmount)) {
        const rawValue = row[2];
        errors.push(`Row ${i + 1}: Invalid amount (Column C: "${rawValue}")`);
        continue;
      }

      data.push({
        paymentDate,
        grossAmount,
        channel,
        titleName,
        rowNumber: i + 1,
      });
    }

    return {
      success: data.length > 0,
      data,
      errors,
    };
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    return {
      success: false,
      data: [],
      errors: [`Failed to parse Excel file: ${error.message}`],
    };
  }
}

export async function parseCSVFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const errors: string[] = [];
    const data: ParsedPaymentRow[] = [];

    Papa.parse(file, {
      complete: (results) => {
        try {
          const rows = results.data as any[][];

          if (rows.length === 0) {
            resolve({
              success: false,
              data: [],
              errors: ['CSV file is empty'],
            });
            return;
          }

          const headerRow = rows[0];
          let dateCol = 0;
          let grossCol = 2;
          let channelCol = 6;
          let titleCol = 7;

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];

            if (!row || row.length === 0 || !row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
              continue;
            }

            const paymentDate = parseDate(row[dateCol]);
            const grossAmount = parseAmount(row[grossCol]);
            const channel = row[channelCol] ? String(row[channelCol]).trim() : '';
            const titleName = row[titleCol] ? String(row[titleCol]).trim() : '';

            if (!titleName) {
              errors.push(`Row ${i + 1}: Missing title name (Column ${String.fromCharCode(65 + titleCol)})`);
              continue;
            }

            if (!paymentDate) {
              errors.push(`Row ${i + 1}: Invalid or missing payment date (Column ${String.fromCharCode(65 + dateCol)})`);
              continue;
            }

            if (grossAmount === null || isNaN(grossAmount)) {
              const rawValue = row[grossCol];
              errors.push(`Row ${i + 1}: Invalid amount "${rawValue}" (Column ${String.fromCharCode(65 + grossCol)})`);
              continue;
            }

            data.push({
              paymentDate,
              grossAmount,
              channel,
              titleName,
              rowNumber: i + 1,
            });
          }

          resolve({
            success: data.length > 0,
            data,
            errors,
          });
        } catch (error) {
          resolve({
            success: false,
            data: [],
            errors: [`Failed to parse CSV file: ${error.message}`],
          });
        }
      },
      error: (error) => {
        resolve({
          success: false,
          data: [],
          errors: [`Failed to parse CSV file: ${error.message}`],
        });
      },
    });
  });
}

export async function parsePaymentFile(file: File): Promise<ParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    return parseCSVFile(file);
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseExcelFile(file);
  } else {
    return {
      success: false,
      data: [],
      errors: ['Unsupported file format. Please use .xlsx, .xls, or .csv files.'],
    };
  }
}
