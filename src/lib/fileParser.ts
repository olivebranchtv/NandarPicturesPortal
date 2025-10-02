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

function parseAmount(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export async function parseExcelFile(file: File): Promise<ParseResult> {
  const errors: string[] = [];
  const data: ParsedPaymentRow[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false });

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];

      if (!row || row.length === 0 || !row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
        continue;
      }

      const paymentDate = parseDate(row[0]);
      const grossAmount = parseAmount(row[1]);
      const channel = row[7] ? String(row[7]).trim() : '';
      const titleName = row[8] ? String(row[8]).trim() : '';

      if (!titleName) {
        errors.push(`Row ${i + 1}: Missing title name`);
        continue;
      }

      if (!paymentDate) {
        errors.push(`Row ${i + 1}: Invalid or missing payment date`);
        continue;
      }

      if (grossAmount <= 0) {
        errors.push(`Row ${i + 1}: Invalid amount`);
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

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];

            if (!row || row.length === 0 || !row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
              continue;
            }

            const paymentDate = parseDate(row[0]);
            const grossAmount = parseAmount(row[1]);
            const channel = row[7] ? String(row[7]).trim() : '';
            const titleName = row[8] ? String(row[8]).trim() : '';

            if (!titleName) {
              errors.push(`Row ${i + 1}: Missing title name`);
              continue;
            }

            if (!paymentDate) {
              errors.push(`Row ${i + 1}: Invalid or missing payment date`);
              continue;
            }

            if (grossAmount <= 0) {
              errors.push(`Row ${i + 1}: Invalid amount`);
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
