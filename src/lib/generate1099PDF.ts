import jsPDF from 'jspdf';
import { User } from './supabase';

export interface TaxYear1099 {
  year: number;
  filmmaker: User & { zelle_identifier?: string };
  totalPaid: number;           // Box 1 — nonemployee compensation
  federalTaxWithheld: number;  // Box 4 — usually 0
  stateTaxWithheld: number;    // Box 5 — usually 0
}

// Nandar Pictures payer info — update if address changes
const PAYER = {
  name:    'Nandar Pictures LLC',
  address: '9776 SW 72nd ST',
  city:    'Lake Butler',
  state:   'FL',
  zip:     '32054',
  ein:     '82-0646688',
  phone:   '',
};

function box(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  label: string, value: string,
  highlight = false,
) {
  if (highlight) {
    doc.setFillColor(255, 249, 230);
    doc.rect(x, y, w, h, 'F');
  }
  doc.setDrawColor(160, 160, 160);
  doc.rect(x, y, w, h, 'S');
  doc.setFontSize(6);
  doc.setTextColor(100, 100, 100);
  doc.text(label, x + 1.5, y + 4);
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.text(value, x + 1.5, y + 10);
  doc.setFont('helvetica', 'normal');
}

function money(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function generate1099PDF(data: TaxYear1099) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pw = 215.9; // letter width mm

  // ── Header banner ──────────────────────────────────────────
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pw, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('NANDAR PICTURES', 14, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Payer Copy — For Record Keeping Only', 14, 16);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Form 1099-NEC  •  Tax Year ${data.year}`, pw - 14, 13, { align: 'right' });

  // ── IRS disclaimer ─────────────────────────────────────────
  doc.setFillColor(254, 243, 199);
  doc.rect(0, 22, pw, 9, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 53, 15);
  doc.text(
    'IMPORTANT: This document is a summary for your records. Official IRS Copy B will be issued separately by January 31. ' +
    'Consult a tax professional for filing guidance.',
    pw / 2, 27.5, { align: 'center' },
  );

  // ── Section: Payer (Nandar Pictures) ───────────────────────
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  let y = 38;
  doc.text("PAYER'S name, street address, city, state, ZIP code, and telephone no.", 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y += 5;
  doc.text(PAYER.name, 14, y); y += 5;
  doc.text(PAYER.address, 14, y); y += 5;
  doc.text(`${PAYER.city}, ${PAYER.state}  ${PAYER.zip}`, 14, y); y += 5;
  doc.text(PAYER.phone, 14, y);

  // Payer EIN on right
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text("PAYER'S TIN", pw - 80, 43);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(PAYER.ein, pw - 80, 50);

  // ── Divider ────────────────────────────────────────────────
  y = 72;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, y, pw - 14, y);

  // ── Section: Recipient ─────────────────────────────────────
  y += 6;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text("RECIPIENT'S name", 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  y += 5;
  const recipientName = [data.filmmaker.first_name, data.filmmaker.last_name].filter(Boolean).join(' ') || data.filmmaker.email;
  doc.text(recipientName, 14, y);

  y += 7;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Street address (including apt. no.)', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y += 5;
  doc.text(data.filmmaker.address || '(address not on file)', 14, y);

  y += 6;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('City, state, and ZIP code', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y += 5;
  const cityLine = [data.filmmaker.city, data.filmmaker.state, data.filmmaker.zip_code].filter(Boolean).join(', ');
  doc.text(cityLine || '(city/state/zip not on file)', 14, y);

  // Recipient TIN (right column — filmmaker fills in their SSN/EIN)
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text("RECIPIENT'S TIN", pw - 80, 80);
  doc.setFillColor(245, 245, 245);
  doc.rect(pw - 80, 83, 62, 8, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('(Recipient fills in SSN or EIN)', pw - 80 + 1, 89);
  doc.setTextColor(20, 20, 20);

  // ── Divider ────────────────────────────────────────────────
  y = 122;
  doc.line(14, y, pw - 14, y);

  // ── Form boxes ─────────────────────────────────────────────
  y += 5;
  const bw = (pw - 28) / 3; // box width
  const bh = 18;

  // Box 1 — Nonemployee compensation (THE KEY BOX)
  box(doc, 14,          y, bw, bh, '1  Nonemployee compensation', money(data.totalPaid), true);
  // Box 2 — Payer made direct sales (checkbox — leave blank)
  box(doc, 14 + bw,     y, bw, bh, '2  Direct sales of $5,000+', '☐ Check if yes', false);
  // Box 4 — Federal income tax withheld
  box(doc, 14 + bw * 2, y, bw, bh, '4  Federal income tax withheld', money(data.federalTaxWithheld), false);

  y += bh + 2;
  // Box 5 — State tax withheld
  box(doc, 14,          y, bw, bh, '5  State tax withheld', money(data.stateTaxWithheld), false);
  // Box 6 — State / payer's state no.
  box(doc, 14 + bw,     y, bw, bh, '6  State / Payer state no.', `${PAYER.state} / —`, false);
  // Box 7 — State income
  box(doc, 14 + bw * 2, y, bw, bh, '7  State income', money(0), false);

  // ── Total earned summary banner ────────────────────────────
  y += bh + 10;
  doc.setFillColor(15, 23, 42);
  doc.rect(14, y, pw - 28, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Total Nonemployee Compensation — Box 1', 20, y + 7);
  doc.setFontSize(16);
  doc.text(money(data.totalPaid), pw - 14, y + 10, { align: 'right' });

  // ── Payment breakdown table ────────────────────────────────
  y += 26;
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Payment History — ${data.year}`, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('Approved payout requests paid during the tax year', 14, y + 5);

  y += 10;
  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, pw - 28, 7, 'F');
  doc.setTextColor(70, 70, 70);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', 16, y + 5);
  doc.text('Amount Paid', pw - 16, y + 5, { align: 'right' });

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);

  // Single line — total approved payout requests
  doc.text(`Filmmaker royalty payments — tax year ${data.year}`, 16, y + 5);
  doc.text(money(data.totalPaid), pw - 16, y + 5, { align: 'right' });
  doc.setDrawColor(230, 230, 230);
  doc.line(14, y + 8, pw - 14, y + 8);

  y += 14;
  // Total row
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TOTAL (Box 1)', 16, y);
  doc.text(money(data.totalPaid), pw - 16, y, { align: 'right' });

  // ── Contact & payout info ──────────────────────────────────
  y += 14;
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pw - 14, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Payout Method on File', 14, y);
  doc.setFont('helvetica', 'normal');
  const parts: string[] = [];
  if (data.filmmaker.paypal_email) parts.push(`PayPal: ${data.filmmaker.paypal_email}`);
  if (data.filmmaker.venmo_username) parts.push(`Venmo: @${data.filmmaker.venmo_username}`);
  if (data.filmmaker.zelle_identifier) parts.push(`Zelle: ${data.filmmaker.zelle_identifier}`);
  doc.text(parts.join('   |   ') || 'None on file', 14, y + 5);

  // ── Footer ─────────────────────────────────────────────────
  const fy = 265;
  doc.setFillColor(241, 245, 249);
  doc.rect(0, fy, pw, 22, 'F');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Generated by Nandar Pictures Portal  •  ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    pw / 2, fy + 6, { align: 'center' },
  );
  doc.text(
    'This document is for informational purposes. Recipients must report income on their federal tax return.',
    pw / 2, fy + 11, { align: 'center' },
  );
  doc.text(
    `Payments ≥ $600 in a calendar year are reportable on Form 1099-NEC. EIN: ${PAYER.ein}`,
    pw / 2, fy + 16, { align: 'center' },
  );

  doc.save(`1099-NEC_${data.year}_${recipientName.replace(/\s+/g, '_')}.pdf`);
}
