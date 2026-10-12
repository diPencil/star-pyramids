// Phase A/B: booking PDF renderer.
//
// Server-side PDF rendering with pdfkit (no browser automation). The
// renderer is a pure function of a PdfDocumentModel: it never touches
// the database, never issues documents, and never invents data — every
// string and amount on the page comes from the model built in
// lib/server/document-pdf.ts.
//
// Visual identity follows DESIGN_SYSTEM.md: action orange #F7951D
// accents, navigation blue #163A96 for receipt emphasis, text #1D1F1F,
// hairlines #DEDEDE, soft panels #F7F7F7, Montserrat typography.
// Layout is A4 with 54pt margins, section headings, label/value rows,
// a receipt hero panel, automatic pagination, and a per-page footer.
import 'server-only';

import PDFDocument from 'pdfkit';

import {
  MONTSERRAT_BOLD,
  MONTSERRAT_MEDIUM,
  MONTSERRAT_REGULAR,
  MONTSERRAT_SEMIBOLD,
} from './fonts';
import {
  formatUsdAmount,
  formatUtcDay,
  refundMethodLabel,
  type PdfDocumentModel,
  type PdfLineItem,
} from './model';

const PRIMARY = '#F7951D';
const BLUE = '#163A96';
const TEXT = '#1D1F1F';
const MUTED = '#6F7272';
const BORDER = '#DEDEDE';
const SOFT = '#F7F7F7';

const MARGIN = 54;
const BOTTOM_RESERVE = 72;

/** Removes control characters; optionally keeps newlines for notes. */
function cleanText(value: string, allowNewlines = false): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code === 10 && allowNewlines) {
      out += '\n';
    } else if (code >= 32 && code !== 127) {
      out += value[i];
    }
  }
  return allowNewlines ? out : out.replace(/\s+/g, ' ').trim();
}

type Doc = InstanceType<typeof PDFDocument>;

function contentWidth(doc: Doc): number {
  return doc.page.width - MARGIN * 2;
}

/** Switches to a new page when the block would cross the bottom margin. */
function ensureSpace(doc: Doc, y: number, height: number): number {
  if (y + height > doc.page.height - BOTTOM_RESERVE) {
    doc.addPage();
    return doc.page.margins.top;
  }
  return y;
}

function hairline(doc: Doc, y: number, color = BORDER, width = 0.5): number {
  doc
    .moveTo(MARGIN, y)
    .lineTo(doc.page.width - MARGIN, y)
    .lineWidth(width)
    .stroke(color);
  return y + 6;
}

function sectionTitle(doc: Doc, y: number, label: string): number {
  y = ensureSpace(doc, y, 30);
  doc.rect(MARGIN, y + 1, 18, 2.5).fill(PRIMARY);
  doc
    .font(MONTSERRAT_SEMIBOLD)
    .fontSize(9)
    .fillColor(MUTED)
    .text(label.toUpperCase(), MARGIN + 26, y, {
      characterSpacing: 1.1,
      lineBreak: false,
    });
  return y + 20;
}

function labelValueRow(
  doc: Doc,
  y: number,
  label: string,
  value: string,
  opts: { valueFont?: Buffer; valueSize?: number; valueColor?: string } = {},
): number {
  y = ensureSpace(doc, y, 18);
  doc
    .font(MONTSERRAT_REGULAR)
    .fontSize(8.5)
    .fillColor(MUTED)
    .text(label, MARGIN, y + 2, { lineBreak: false });
  const font = opts.valueFont ?? MONTSERRAT_REGULAR;
  const size = opts.valueSize ?? 9.5;
  doc.font(font).fontSize(size).fillColor(opts.valueColor ?? TEXT);
  const width = doc.widthOfString(value);
  doc.text(value, doc.page.width - MARGIN - width, y, { lineBreak: false });
  return y + 17;
}

function drawHeader(doc: Doc, model: PdfDocumentModel): number {
  let y = doc.page.margins.top;

  // Brand block (left): logo stacked ABOVE the wordmark. The logo file
  // carries the brand artwork at an unpredictable aspect ratio, so it is
  // proportionally fitted and the text always starts below it — never
  // beside it, where a wide logo would overlap the text.
  let textY = y;
  if (model.issuer.logoData) {
    try {
      doc.image(model.issuer.logoData, MARGIN, y, { fit: [190, 40] });
      textY = y + 48;
    } catch {
      textY = y;
    }
  }

  doc
    .font(MONTSERRAT_BOLD)
    .fontSize(14)
    .fillColor(TEXT)
    .text('STAR PYRAMIDS', MARGIN, textY, { lineBreak: false });
  doc
    .font(MONTSERRAT_REGULAR)
    .fontSize(7.5)
    .fillColor(MUTED)
    .text(cleanText(model.issuer.companyName), MARGIN, textY + 18, { lineBreak: false });
  doc
    .text(cleanText(model.issuer.email), MARGIN, textY + 29, { lineBreak: false });

  const rightLines: Array<{ text: string; font: Buffer; size: number; color: string }> = [
    { text: model.document.typeLabel, font: MONTSERRAT_BOLD, size: 15, color: TEXT },
    { text: model.document.number, font: MONTSERRAT_MEDIUM, size: 9.5, color: TEXT },
    { text: `Issued ${formatUtcDay(model.document.issuedAt)}`, font: MONTSERRAT_REGULAR, size: 8.5, color: MUTED },
  ];
  let rightY = y;
  for (const line of rightLines) {
    doc.font(line.font).fontSize(line.size).fillColor(line.color);
    const width = doc.widthOfString(line.text);
    doc.text(line.text, doc.page.width - MARGIN - width, rightY, { lineBreak: false });
    rightY += line.size + 5;
  }

  y = Math.max(textY + 44, rightY + 8);
  doc.rect(MARGIN, y, 44, 3).fill(PRIMARY);
  return hairline(doc, y + 11);
}

function drawLineItem(doc: Doc, y: number, line: PdfLineItem): number {
  y = ensureSpace(doc, y, 64);
  doc
    .font(MONTSERRAT_SEMIBOLD)
    .fontSize(10.5)
    .fillColor(TEXT)
    .text(cleanText(line.title), MARGIN, y, { width: contentWidth(doc) });
  y = doc.y + 5;

  const travelers = `${line.adults + line.children + line.infants} (${line.adults} adults · ${line.children} children · ${line.infants} infants)`;
  y = labelValueRow(doc, y, 'Travel date', line.travelDate ?? 'Open date');
  y = labelValueRow(doc, y, 'Travelers', travelers);
  if (line.addons.length > 0) {
    y = labelValueRow(doc, y, 'Add-ons', cleanText(line.addons.join(' · ')));
  }
  return y + 4;
}

function drawReceiptPanel(doc: Doc, y: number, model: PdfDocumentModel): number {
  const receipt = model.receipt;
  if (!receipt) return y;

  y = ensureSpace(doc, y, 74);
  const panelHeight = 66;
  doc.rect(MARGIN, y, contentWidth(doc), panelHeight).fill(SOFT);
  doc.rect(MARGIN, y, 3.5, panelHeight).fill(BLUE);

  doc
    .font(MONTSERRAT_SEMIBOLD)
    .fontSize(8.5)
    .fillColor(MUTED)
    .text('AMOUNT RECEIVED', MARGIN + 18, y + 12, { characterSpacing: 1, lineBreak: false });
  doc
    .font(MONTSERRAT_BOLD)
    .fontSize(17)
    .fillColor(BLUE)
    .text(formatUsdAmount(receipt.amountReceivedCents), MARGIN + 18, y + 28, { lineBreak: false });

  const meta: Array<[string, string]> = [
    ['Payment reference', receipt.paymentReference],
    ['Method', cleanText(receipt.provider)],
    ['Paid on', receipt.paidOn ? formatUtcDay(receipt.paidOn) : '—'],
  ];
  let metaY = y + 12;
  for (const [label, value] of meta) {
    doc
      .font(MONTSERRAT_REGULAR)
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(label, MARGIN + 18, metaY, { lineBreak: false });
    doc.font(MONTSERRAT_MEDIUM).fontSize(9).fillColor(TEXT);
    const width = doc.widthOfString(value);
    doc.text(value, doc.page.width - MARGIN - 16 - width, metaY - 1, { lineBreak: false });
    metaY += 16;
  }

  y += panelHeight + 8;
  if (receipt.refundedToDateCents > 0) {
    y = labelValueRow(
      doc,
      y,
      'Refunded to date',
      formatUsdAmount(receipt.refundedToDateCents),
      { valueFont: MONTSERRAT_MEDIUM },
    );
  }
  return y + 2;
}

function drawInvoiceSection(doc: Doc, y: number, model: PdfDocumentModel): number {
  const invoice = model.invoice;
  if (!invoice) return y;

  y = sectionTitle(doc, y, 'Services');
  for (let i = 0; i < invoice.lines.length; i += 1) {
    const line = invoice.lines[i];
    y = ensureSpace(doc, y, 64);
    doc
      .font(MONTSERRAT_SEMIBOLD)
      .fontSize(10.5)
      .fillColor(TEXT)
      .text(cleanText(line.title), MARGIN, y, { width: contentWidth(doc) });
    y = doc.y + 5;
    y = labelValueRow(doc, y, 'Travel date', line.travelDate ?? 'Open date');
    y = labelValueRow(doc, y, 'Travelers', cleanText(line.travelers));
    if (line.unitPrices) {
      y = labelValueRow(doc, y, 'Unit prices', cleanText(line.unitPrices));
    }
    if (line.addons.length > 0) {
      y = labelValueRow(doc, y, 'Add-ons', cleanText(line.addons.join(' · ')));
    }
    y = labelValueRow(doc, y, 'Line total', formatUsdAmount(line.lineTotalCents), {
      valueFont: MONTSERRAT_MEDIUM,
    });
    y += 4;
    if (i < invoice.lines.length - 1) y = hairline(doc, y);
  }

  y = sectionTitle(doc, y + 4, 'Amounts');
  y = labelValueRow(doc, y, 'Subtotal (at issue)', formatUsdAmount(invoice.subtotalCents));
  if (invoice.discountCents > 0) {
    y = labelValueRow(doc, y, 'Discount (at issue)', `-${formatUsdAmount(invoice.discountCents)}`);
  }
  y = hairline(doc, y, PRIMARY, 1.2);
  y = labelValueRow(doc, y, 'Total (at issue)', formatUsdAmount(invoice.totalCents), {
    valueFont: MONTSERRAT_SEMIBOLD,
    valueSize: 11,
  });

  y = sectionTitle(doc, y + 4, 'Payments to date');
  if (invoice.paymentsToDate.length === 0) {
    y = ensureSpace(doc, y, 18);
    doc.font(MONTSERRAT_REGULAR).fontSize(9).fillColor(MUTED)
      .text('No verified payments recorded yet.', MARGIN, y, { lineBreak: false });
    y = doc.y + 6;
  } else {
    for (const payment of invoice.paymentsToDate) {
      const when = payment.paidOn ? ` · paid ${formatUtcDay(payment.paidOn)}` : '';
      y = labelValueRow(
        doc,
        y,
        cleanText(payment.reference),
        `${formatUsdAmount(payment.amountPaidCents)}${when}`,
        { valueFont: MONTSERRAT_MEDIUM },
      );
    }
    y = labelValueRow(doc, y, 'Verified paid to date', formatUsdAmount(invoice.paidToDateCents));
  }
  if (invoice.refundedToDateCents > 0) {
    y = labelValueRow(doc, y, 'Refunded to date', formatUsdAmount(invoice.refundedToDateCents));
  }

  // Balance-due hero: live computation, explicitly dated.
  y = ensureSpace(doc, y + 4, 78);
  const panelHeight = 62;
  doc.rect(MARGIN, y, contentWidth(doc), panelHeight).fill(SOFT);
  doc.rect(MARGIN, y, 3.5, panelHeight).fill(PRIMARY);
  doc
    .font(MONTSERRAT_SEMIBOLD)
    .fontSize(8.5)
    .fillColor(MUTED)
    .text('BALANCE DUE', MARGIN + 18, y + 11, { characterSpacing: 1, lineBreak: false });
  doc
    .font(MONTSERRAT_BOLD)
    .fontSize(17)
    .fillColor(TEXT)
    .text(formatUsdAmount(invoice.balanceDueCents), MARGIN + 18, y + 26, { lineBreak: false });
  doc
    .font(MONTSERRAT_REGULAR)
    .fontSize(8)
    .fillColor(MUTED)
    .text(`As of ${formatUtcDay(invoice.balanceAsOf)}`, MARGIN + 18, y + 48, { lineBreak: false });
  return y + panelHeight + 8;
}

function drawVoucherSection(doc: Doc, y: number, model: PdfDocumentModel): number {
  const voucher = model.voucher;
  if (!voucher) return y;

  // Voucher hero: identity panel, no money anywhere.
  y = ensureSpace(doc, y, 92);
  const panelHeight = 82;
  doc.rect(MARGIN, y, contentWidth(doc), panelHeight).fill(SOFT);
  doc.rect(MARGIN, y, 3.5, panelHeight).fill(PRIMARY);
  doc
    .font(MONTSERRAT_SEMIBOLD)
    .fontSize(8.5)
    .fillColor(MUTED)
    .text('VOUCHER', MARGIN + 18, y + 10, { characterSpacing: 1, lineBreak: false });
  doc
    .font(MONTSERRAT_BOLD)
    .fontSize(15)
    .fillColor(TEXT)
    .text(cleanText(model.document.number), MARGIN + 18, y + 25, { lineBreak: false });
  doc
    .font(MONTSERRAT_REGULAR)
    .fontSize(9)
    .fillColor(TEXT)
    .text(cleanText(voucher.customerName), MARGIN + 18, y + 46, { lineBreak: false });
  doc
    .font(MONTSERRAT_REGULAR)
    .fontSize(8)
    .fillColor(MUTED)
    .text(`Booking ${model.document.bookingReference} · Issued ${formatUtcDay(model.document.issuedAt)}`, MARGIN + 18, y + 60, { lineBreak: false });
  y += panelHeight + 8;

  y = sectionTitle(doc, y, 'Services');
  for (let i = 0; i < voucher.services.length; i += 1) {
    const service = voucher.services[i];
    y = ensureSpace(doc, y, 56);
    doc
      .font(MONTSERRAT_SEMIBOLD)
      .fontSize(10.5)
      .fillColor(TEXT)
      .text(cleanText(service.title), MARGIN, y, { width: contentWidth(doc) });
    y = doc.y + 5;
    y = labelValueRow(doc, y, 'Service date', service.travelDate ?? 'Open date');
    y = labelValueRow(doc, y, 'Participants', cleanText(service.travelers));
    if (service.addons.length > 0) {
      y = labelValueRow(doc, y, 'Add-ons', cleanText(service.addons.join(' · ')));
    }
    y += 4;
    if (i < voucher.services.length - 1) y = hairline(doc, y);
  }

  // Verification block: QR plus the human-readable URL.
  y = sectionTitle(doc, y + 4, 'Verification');
  y = ensureSpace(doc, y, 150);
  const qrSize = 128;
  let textX = MARGIN;
  if (voucher.qrPng) {
    try {
      doc.image(voucher.qrPng, MARGIN, y, { width: qrSize });
      try {
        doc.link(MARGIN, y, qrSize, qrSize, voucher.verificationUrl);
      } catch {
        // Clickable QR is a nicety; the printed code is the contract.
      }
      textX = MARGIN + qrSize + 18;
    } catch {
      textX = MARGIN;
    }
  }
  const textWidth = doc.page.width - MARGIN - textX;
  doc
    .font(MONTSERRAT_SEMIBOLD)
    .fontSize(9)
    .fillColor(TEXT)
    .text('Scan to verify this voucher', textX, y + 4, { width: textWidth });
  if (voucher.verificationUrl) {
    doc
      .font(MONTSERRAT_REGULAR)
      .fontSize(7.5)
      .fillColor(BLUE)
      .text(cleanText(voucher.verificationUrl), textX, y + 20, { width: textWidth });
  }
  doc
    .font(MONTSERRAT_REGULAR)
    .fontSize(8)
    .fillColor(MUTED)
    .text(
      'The verification page confirms only that this voucher is authentic and its booking still stands. Present this voucher to our team on the service day.',
      textX,
      y + 44,
      { width: textWidth, lineGap: 1.5 },
    );
  return Math.max(doc.y, y + qrSize) + 8;
}

function drawRefundSection(doc: Doc, y: number, model: PdfDocumentModel): number {
  const refund = model.refundNote;
  if (!refund) return y;

  // Refund hero: frozen amount plus full/partial scope.
  y = ensureSpace(doc, y, 78);
  const panelHeight = 66;
  doc.rect(MARGIN, y, contentWidth(doc), panelHeight).fill(SOFT);
  doc.rect(MARGIN, y, 3.5, panelHeight).fill(BLUE);
  doc
    .font(MONTSERRAT_SEMIBOLD)
    .fontSize(8.5)
    .fillColor(MUTED)
    .text(refund.scope === 'full' ? 'FULL REFUND' : 'PARTIAL REFUND', MARGIN + 18, y + 11, {
      characterSpacing: 1,
      lineBreak: false,
    });
  doc
    .font(MONTSERRAT_BOLD)
    .fontSize(17)
    .fillColor(BLUE)
    .text(formatUsdAmount(refund.amountCents), MARGIN + 18, y + 27, { lineBreak: false });
  y += panelHeight + 8;

  y = sectionTitle(doc, y, 'Refund details');
  y = labelValueRow(doc, y, 'Original booking', model.document.bookingReference, {
    valueFont: MONTSERRAT_MEDIUM,
  });
  y = labelValueRow(doc, y, 'Payment reference', cleanText(refund.paymentReference), {
    valueFont: MONTSERRAT_MEDIUM,
  });
  y = labelValueRow(doc, y, 'Refund date', formatUtcDay(refund.refundDate));
  y = labelValueRow(doc, y, 'Refund method', refundMethodLabel(refund.method));
  if (refund.externalReference) {
    y = labelValueRow(doc, y, 'External reference', cleanText(refund.externalReference));
  }
  return y + 2;
}

function drawClosingBlock(doc: Doc, y: number, model: PdfDocumentModel): number {
  y = ensureSpace(doc, y, 90);
  y = hairline(doc, y);

  doc
    .font(MONTSERRAT_SEMIBOLD)
    .fontSize(8.5)
    .fillColor(TEXT)
    .text(cleanText(model.issuer.companyName), MARGIN, y, { lineBreak: false });
  y += 12;
  doc
    .font(MONTSERRAT_REGULAR)
    .fontSize(7.5)
    .fillColor(MUTED)
    .text(
      cleanText([model.issuer.address, model.issuer.email, model.issuer.phone].filter(Boolean).join(' · ')),
      MARGIN,
      y,
      { width: contentWidth(doc) },
    );
  y = doc.y + 4;

  const legalRows: Array<[string, string]> = [];
  // Phase D documents never show registration/tax/legal rows, even when
  // configured — commercial invoices are explicitly not tax invoices.
  if (!model.hideLegalRows) {
    if (model.issuer.legalEntityName) legalRows.push(['Legal entity', model.issuer.legalEntityName]);
    if (model.issuer.registrationNumber) legalRows.push(['Registration number', model.issuer.registrationNumber]);
    if (model.issuer.taxNumber) legalRows.push(['Tax number', model.issuer.taxNumber]);
  }
  for (const [label, value] of legalRows) {
    doc.font(MONTSERRAT_REGULAR).fontSize(7.5).fillColor(MUTED);
    doc.text(`${label}: ${cleanText(value)}`, MARGIN, y, { width: contentWidth(doc) });
    y = doc.y + 2;
  }

  y += 6;
  if (model.notice) {
    y = ensureSpace(doc, y, 48);
    const noticeText = cleanText(model.notice);
    const textHeight = doc.font(MONTSERRAT_REGULAR).fontSize(8).heightOfString(noticeText, {
      width: contentWidth(doc) - 28,
    });
    const panelHeight = Math.max(34, textHeight + 26);
    doc.rect(MARGIN, y, contentWidth(doc), panelHeight).fill(SOFT);
    doc.rect(MARGIN, y, 3.5, panelHeight).fill(PRIMARY);
    doc.font(MONTSERRAT_SEMIBOLD).fontSize(8).fillColor(TEXT).text('Notice', MARGIN + 16, y + 9, {
      lineBreak: false,
    });
    doc
      .font(MONTSERRAT_REGULAR)
      .fontSize(8)
      .fillColor(TEXT)
      .text(noticeText, MARGIN + 16, y + 20, { width: contentWidth(doc) - 28, lineGap: 1.5 });
    y += panelHeight + 10;
  }

  doc
    .font(MONTSERRAT_REGULAR)
    .fontSize(7.5)
    .fillColor(MUTED)
    .text(
      `Quote booking reference ${model.document.bookingReference} when contacting ${cleanText(model.issuer.companyName)}.`,
      MARGIN,
      y,
      { width: contentWidth(doc) },
    );
  return doc.y;
}

function drawFooters(doc: Doc, model: PdfDocumentModel): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const footerY = doc.page.height - 48;
    doc
      .moveTo(MARGIN, footerY - 10)
      .lineTo(doc.page.width - MARGIN, footerY - 10)
      .lineWidth(0.5)
      .stroke(BORDER);
    doc.font(MONTSERRAT_REGULAR).fontSize(7.5).fillColor(MUTED);
    const left = `${cleanText(model.issuer.companyName)} · ${model.document.number}`;
    doc.text(left, MARGIN, footerY, { lineBreak: false });
    const pageLabel = `Page ${i - range.start + 1} of ${range.count}`;
    const width = doc.widthOfString(pageLabel);
    doc.text(pageLabel, doc.page.width - MARGIN - width, footerY, { lineBreak: false });
  }
  doc.flushPages();
}

/**
 * Renders one A4 PDF for an issued booking document. Returns the raw
 * PDF bytes. Never mutates anything and never issues documents.
 */
export function renderBookingDocumentPdf(model: PdfDocumentModel): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      bufferPages: true,
      compress: true,
      info: {
        Title: `${model.document.typeLabel} ${model.document.number}`,
        Author: cleanText(model.issuer.companyName),
        Producer: 'Star Pyramids Documents',
        Creator: 'Star Pyramids Documents',
        CreationDate: new Date(),
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', reject);

    let y = drawHeader(doc, model);

    y = sectionTitle(doc, y, 'Booking');
    y = labelValueRow(doc, y, 'Booking reference', model.document.bookingReference, {
      valueFont: MONTSERRAT_MEDIUM,
    });
    y = labelValueRow(doc, y, 'Booking status', model.booking.statusLabel);

    y = sectionTitle(doc, y + 4, 'Traveler details');
    y = labelValueRow(doc, y, 'Name', cleanText(model.booking.contactName));
    y = labelValueRow(doc, y, 'Email', cleanText(model.booking.contactEmail));
    y = labelValueRow(doc, y, 'Phone', cleanText(model.booking.contactPhone));
    if (model.booking.notes) {
      const notes = cleanText(model.booking.notes, true);
      y = ensureSpace(doc, y, 40);
      doc.font(MONTSERRAT_SEMIBOLD).fontSize(8.5).fillColor(MUTED).text('Notes', MARGIN, y, { lineBreak: false });
      doc
        .font(MONTSERRAT_REGULAR)
        .fontSize(9)
        .fillColor(TEXT)
        .text(notes, MARGIN + 70, y, { width: contentWidth(doc) - 70, lineGap: 1.5 });
      y = doc.y + 4;
    }

    if (model.booking.lines.length > 0) {
      y = sectionTitle(doc, y + 4, 'Booked trips');
      for (let i = 0; i < model.booking.lines.length; i += 1) {
        y = drawLineItem(doc, y, model.booking.lines[i]);
        if (i < model.booking.lines.length - 1) y = hairline(doc, y);
      }
    }

    if (model.receipt) {
      y = sectionTitle(doc, y + 6, 'Payment');
      y = drawReceiptPanel(doc, y, model);
    } else if (model.invoice) {
      y = drawInvoiceSection(doc, y + 2, model);
    } else if (model.voucher) {
      y = drawVoucherSection(doc, y + 2, model);
    } else if (model.refundNote) {
      y = drawRefundSection(doc, y + 2, model);
    } else if (model.booking.summary) {
      const summary = model.booking.summary;
      y = sectionTitle(doc, y + 6, 'Financial summary');
      y = labelValueRow(doc, y, 'Payment status', summary.paymentStatus, {
        valueFont: MONTSERRAT_SEMIBOLD,
      });
      y = hairline(doc, y, PRIMARY, 1.2);
      y = labelValueRow(doc, y, 'Total (at issue)', formatUsdAmount(summary.totalAtIssueCents), {
        valueFont: MONTSERRAT_SEMIBOLD,
        valueSize: 11,
      });
      if (summary.hasPayments) {
        y = labelValueRow(doc, y, 'Verified paid to date', formatUsdAmount(summary.paidToDateCents));
        if (summary.refundedToDateCents > 0) {
          y = labelValueRow(doc, y, 'Refunded to date', formatUsdAmount(summary.refundedToDateCents));
        }
        y = labelValueRow(doc, y, 'Remaining balance', formatUsdAmount(summary.remainingCents), {
          valueFont: MONTSERRAT_MEDIUM,
        });
      }
    }

    y = drawClosingBlock(doc, y + 8, model);
    drawFooters(doc, model);
    doc.end();
  });
}


