import jsPDF from 'jspdf';
import { User, Content, Payment } from './supabase';
import { formatCurrency } from './formatters';

export interface StatementPeriod {
  label: string;
  startDate: Date;
  endDate: Date;
}

export interface TitleBreakdown {
  titleName: string;
  channels: { channel: string; gross: number; distributionFee: number; net: number }[];
  totalGross: number;
  totalDistributionFee: number;
  totalNet: number;
  companyPercentage: number;
  filmmakerPercentage: number;
}

export interface RoyaltyStatementData {
  filmmaker: User;
  period: StatementPeriod;
  titles: TitleBreakdown[];
  grandTotalGross: number;
  grandTotalFee: number;
  grandTotalNet: number;
  historicalData: { titleName: string; gross: number; net: number; fee: number }[];
  totalPaidThisPeriod: number;
}

export function buildPeriods(type: 'monthly' | 'quarterly'): StatementPeriod[] {
  const now = new Date();
  const periods: StatementPeriod[] = [];

  if (type === 'monthly') {
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      periods.push({
        label: start.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
        startDate: start,
        endDate: end,
      });
    }
  } else {
    for (let i = 7; i >= 0; i--) {
      const quarterIndex = Math.floor(now.getMonth() / 3) - i;
      const year = now.getFullYear() + Math.floor(quarterIndex / 4);
      const quarter = ((quarterIndex % 4) + 4) % 4;
      const start = new Date(year, quarter * 3, 1);
      const end = new Date(year, quarter * 3 + 3, 0);
      const qLabel = `Q${quarter + 1} ${year}`;
      periods.push({ label: qLabel, startDate: start, endDate: end });
    }
  }

  return periods;
}

export function buildStatementData(
  filmmaker: User,
  period: StatementPeriod,
  contents: Content[],
  payments: any[],
): RoyaltyStatementData {
  const start = period.startDate.toISOString().split('T')[0];
  const end = period.endDate.toISOString().split('T')[0];

  const periodPayments = payments.filter(p => {
    const d = p.payment_date?.split('T')[0] ?? '';
    return d >= start && d <= end;
  });

  const titleMap = new Map<string, TitleBreakdown>();

  contents.forEach(content => {
    titleMap.set(content.id, {
      titleName: content.title_name,
      channels: [],
      totalGross: 0,
      totalDistributionFee: 0,
      totalNet: 0,
      companyPercentage: content.title_distribution_settings?.[0]?.company_percentage ?? 25,
      filmmakerPercentage: content.title_distribution_settings?.[0]?.filmmaker_percentage ?? 75,
    });
  });

  periodPayments.forEach(p => {
    if (!p.content_id) return;
    const entry = titleMap.get(p.content_id);
    if (!entry) return;

    const gross = p.gross_amount ?? 0;
    const fee = p.distribution_fee ?? 0;
    const net = p.net_amount ?? 0;
    const channel = p.channel ?? 'Unknown';

    const existing = entry.channels.find(c => c.channel === channel);
    if (existing) {
      existing.gross += gross;
      existing.distributionFee += fee;
      existing.net += net;
    } else {
      entry.channels.push({ channel, gross, distributionFee: fee, net });
    }
    entry.totalGross += gross;
    entry.totalDistributionFee += fee;
    entry.totalNet += net;
  });

  const titles = Array.from(titleMap.values()).filter(t => t.totalGross > 0);

  const grandTotalGross = titles.reduce((s, t) => s + t.totalGross, 0);
  const grandTotalFee = titles.reduce((s, t) => s + t.totalDistributionFee, 0);
  const grandTotalNet = titles.reduce((s, t) => s + t.totalNet, 0);

  // Historical data (not date-filtered — shown separately as legacy)
  const historicalData = contents
    .filter(c => (c.previous_gross_amount ?? 0) > 0)
    .map(c => ({
      titleName: c.title_name,
      gross: c.previous_gross_amount ?? 0,
      net: c.previous_net_revenue ?? 0,
      fee: c.previous_distribution_fee ?? 0,
    }));

  return {
    filmmaker,
    period,
    titles,
    grandTotalGross,
    grandTotalFee,
    grandTotalNet,
    historicalData,
    totalPaidThisPeriod: 0,
  };
}

// ─── PDF rendering ───────────────────────────────────────────────────────────

const BRAND_DARK = [15, 23, 42] as const;       // slate-900
const BRAND_BLUE = [37, 99, 235] as const;       // blue-600
const ACCENT = [241, 245, 249] as const;         // slate-100
const TEXT_MUTED = [100, 116, 139] as const;     // slate-500
const BORDER = [226, 232, 240] as const;         // slate-200
const WHITE = [255, 255, 255] as const;

function rgb(doc: jsPDF, color: readonly [number, number, number]) {
  return color;
}

function drawHRule(doc: jsPDF, y: number, x1 = 14, x2 = 196) {
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(x1, y, x2, y);
}

function labelValue(doc: jsPDF, label: string, value: string, x: number, y: number) {
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(label.toUpperCase(), x, y);
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND_DARK);
  doc.text(value, x, y + 5);
}

export function generateRoyaltyStatementPDF(data: RoyaltyStatementData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = 0;

  // ── Header band ─────────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pageW, 38, 'F');

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text('NANDAR PICTURES', margin, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('ROYALTY STATEMENT', margin, 23);

  // Period badge (top-right)
  const periodText = data.period.label;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  const pw = doc.getTextWidth(periodText);
  doc.text(periodText, pageW - margin - pw, 20);

  y = 50;

  // ── Filmmaker info ───────────────────────────────────────────────────────────
  const name = [data.filmmaker.first_name, data.filmmaker.last_name].filter(Boolean).join(' ') || 'Filmmaker';
  const addressParts = [
    data.filmmaker.address,
    data.filmmaker.city,
    data.filmmaker.state,
    data.filmmaker.zip_code,
  ].filter(Boolean);
  const address = addressParts.join(', ') || '—';

  labelValue(doc, 'Filmmaker', name, margin, y);
  labelValue(doc, 'Email', data.filmmaker.email || '—', margin + 70, y);
  labelValue(doc, 'Address', address, margin + 135, y);

  y += 16;
  drawHRule(doc, y);
  y += 8;

  // Date range
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  labelValue(doc, 'Period Start', fmt(data.period.startDate), margin, y);
  labelValue(doc, 'Period End', fmt(data.period.endDate), margin + 70, y);
  labelValue(doc, 'Generated On', fmt(new Date()), margin + 135, y);

  y += 16;
  drawHRule(doc, y);
  y += 10;

  // ── Per-title breakdown ──────────────────────────────────────────────────────
  if (data.titles.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('No streaming payments recorded for this period.', margin, y + 8);
    y += 24;
  } else {
    data.titles.forEach((title, ti) => {
      // Title header row
      doc.setFillColor(...ACCENT);
      doc.rect(margin, y, contentW, 8, 'F');
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...BRAND_DARK);
      doc.text(title.titleName, margin + 3, y + 5.5);

      // Split info
      const splitText = `${title.filmmakerPercentage}% filmmaker / ${title.companyPercentage}% distribution`;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_MUTED);
      doc.text(splitText, pageW - margin - doc.getTextWidth(splitText), y + 5.5);

      y += 10;

      // Column headers
      const cols = { channel: margin + 3, gross: margin + 85, fee: margin + 120, net: margin + 158 };
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...TEXT_MUTED);
      doc.text('CHANNEL / PLATFORM', cols.channel, y);
      doc.text('GROSS REVENUE', cols.gross, y);
      doc.text('DIST. FEE', cols.fee, y);
      doc.text('YOUR NET', cols.net, y);
      y += 5;
      drawHRule(doc, y, margin, pageW - margin);
      y += 3;

      title.channels.forEach((ch, ci) => {
        if (y > pageH - 30) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...BRAND_DARK);
        doc.text(ch.channel, cols.channel, y);
        doc.text(formatCurrency(ch.gross), cols.gross, y);
        doc.text(formatCurrency(ch.distributionFee), cols.fee, y);
        doc.setFont('helvetica', 'bold');
        doc.text(formatCurrency(ch.net), cols.net, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
      });

      // Title totals
      drawHRule(doc, y, margin + 80, pageW - margin);
      y += 4;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...BRAND_BLUE);
      doc.text('Title Total', cols.channel, y);
      doc.text(formatCurrency(title.totalGross), cols.gross, y);
      doc.text(formatCurrency(title.totalDistributionFee), cols.fee, y);
      doc.text(formatCurrency(title.totalNet), cols.net, y);
      y += 10;

      if (ti < data.titles.length - 1) {
        drawHRule(doc, y);
        y += 6;
      }

      if (y > pageH - 50) {
        doc.addPage();
        y = 20;
      }
    });
  }

  // ── Grand total banner ───────────────────────────────────────────────────────
  if (y > pageH - 50) { doc.addPage(); y = 20; }

  y += 2;
  doc.setFillColor(...BRAND_DARK);
  doc.rect(margin, y, contentW, 12, 'F');

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text('TOTAL FOR PERIOD', margin + 3, y + 8);

  const cols = { gross: margin + 85, fee: margin + 120, net: margin + 158 };
  doc.text(formatCurrency(data.grandTotalGross), cols.gross, y + 8);
  doc.text(formatCurrency(data.grandTotalFee), cols.fee, y + 8);
  doc.setTextColor(134, 239, 172); // green-300
  doc.text(formatCurrency(data.grandTotalNet), cols.net, y + 8);

  y += 18;

  // ── Historical data section (if any) ────────────────────────────────────────
  if (data.historicalData.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 20; }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_DARK);
    doc.text('Historical / Legacy Data (Pre-System)', margin, y);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    doc.text('These figures were migrated from a previous system and are not date-filtered.', margin, y + 5);
    y += 12;

    const hCols = { title: margin + 3, gross: margin + 95, fee: margin + 130, net: margin + 162 };
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT_MUTED);
    doc.text('TITLE', hCols.title, y);
    doc.text('GROSS', hCols.gross, y);
    doc.text('DIST. FEE', hCols.fee, y);
    doc.text('NET', hCols.net, y);
    y += 4;
    drawHRule(doc, y);
    y += 4;

    data.historicalData.forEach(h => {
      if (y > pageH - 25) { doc.addPage(); y = 20; }
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...BRAND_DARK);
      const truncTitle = h.titleName.length > 45 ? h.titleName.slice(0, 42) + '…' : h.titleName;
      doc.text(truncTitle, hCols.title, y);
      doc.text(formatCurrency(h.gross), hCols.gross, y);
      doc.text(formatCurrency(h.fee), hCols.fee, y);
      doc.text(formatCurrency(h.net), hCols.net, y);
      y += 6;
    });
  }

  // ── Footer on every page ─────────────────────────────────────────────────────
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...BRAND_DARK);
    doc.rect(0, pageH - 10, pageW, 10, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Nandar Pictures · Confidential Royalty Statement', margin, pageH - 3.5);
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin - 18, pageH - 3.5);
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  const safePeriod = data.period.label.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeName = [data.filmmaker.first_name, data.filmmaker.last_name]
    .filter(Boolean).join('_') || 'Filmmaker';
  doc.save(`Nandar_Royalty_${safeName}_${safePeriod}.pdf`);
}
