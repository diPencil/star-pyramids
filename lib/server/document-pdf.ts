// Phase B: booking PDF documents. Phase D completed the set: commercial
// invoices, booking vouchers and refund notes render under the same
// safety rules.
//
// Assembles the PdfDocumentModel for an ISSUED document and turns it
// into an HTTP download response. Safety rules:
// - Downloading NEVER issues a document. The only way a PDF exists is
//   a pre-existing BookingDocument row; there is no fallback minting,
//   no auto-issuance on GET, and no side effects of any kind.
// - Access goes through the single Phase-A gate
//   (`getBookingDocumentForActor`): booking owner, staff holding
//   `bookings.view`/`payments.view`, or a guest with a valid token for
//   THIS booking. Every failure collapses to the same uniform 404 so a
//   probe cannot enumerate document ids, distinguish actors, or tell an
//   unknown document from a forbidden one.
// - All six document types render; the gate is the only refusal path.
// - Money on the page: totals come from the immutable amountCents
//   snapshot on the document row; live payment sums are shown only as
//   clearly labeled "to date" rows. Receipts show their own frozen
//   payment amount; unrelated payments never appear. Invoices freeze
//   the booking total, subtotal, discount and line prices, with the
//   balance due explicitly labeled "as of" render time. Vouchers carry
//   no money at all. Refund notes freeze the anchored refund event.
// - No tax, VAT, registration or tax numbers appear on any Phase D
//   document, even when company settings exist.
// - The voucher QR encodes only the absolute verification URL carrying
//   the purpose-specific opaque token — never a guest booking token,
//   never personal or financial data.
// - Responses are `Cache-Control: private, no-store` with an
//   attachment disposition and a sanitized filename. Guest access
//   tokens never appear in URLs used by owner/staff routes, in headers,
//   or in PDF contents/metadata.
import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import QRCode from 'qrcode';

import {
  DOCUMENT_NUMBER_PATTERN,
  ISSUABLE_DOCUMENT_TYPES,
  getBookingDocumentForActor,
  getDocumentIssuer,
  type DocumentAccessActor,
} from './documents';
import { FROM_DB_PAYMENT_STATUS, deriveBookingPaymentSummary } from './payments';
import {
  PDF_TYPE_LABELS,
  bookingStatusLabel,
  formatTravelersLabel,
  paymentStatusLabel,
  refundMethodLabel,
  shapeInvoiceLine,
  type PdfDocumentModel,
  type PdfDocumentType,
  type PdfInvoiceLine,
  type PdfLineItem,
} from './pdf/model';
import { renderBookingDocumentPdf } from './pdf/render';
import { db } from './db';

export interface BookingDocumentPdfFile {
  bytes: Buffer;
  filename: string;
  number: string;
}

function decimalToCents(value: { toString(): string } | number): number {
  return Math.round(Number(value.toString()) * 100);
}

/** Defensive parse of the JSON-text add-ons column (same spirit as bookings.ts). */
function parseAddons(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[')) return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 20);
  } catch {
    return [];
  }
}

/** Local-path brand logo only; remote URLs are never fetched (no SSRF). */
async function resolveLogoData(logoSetting: string): Promise<Buffer | null> {
  const candidates: string[] = [];
  if (logoSetting.startsWith('/') && !logoSetting.includes('..')) {
    candidates.push(logoSetting.slice(1));
  }
  candidates.push('logo.png');
  for (const relative of candidates) {
    try {
      const filePath = path.join(process.cwd(), 'public', relative);
      const data = await readFile(filePath);
      if (data.length > 0 && data.length < 5_000_000) return data;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/**
 * Absolute base URL for voucher QR codes (e.g. `https://tours.example`).
 * Derived from forwarding headers with a same-request fallback, so the
 * QR always encodes a complete verification URL.
 */
export function publicBaseUrl(request: Request): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host') || '';
  if (host) return `${forwardedProto || 'https'}://${host}`;
  try {
    return new URL(request.url).origin;
  } catch {
    return '';
  }
}

/** Renders the QR PNG for a verification URL; null on any failure. */
async function renderVerificationQr(url: string): Promise<Buffer | null> {
  try {
    return await QRCode.toBuffer(url, { type: 'png', margin: 1, width: 360 });
  } catch {
    return null;
  }
}

/**
 * Loads the immutable content model for one issued document, or null
 * when the actor may not access it (uniform denial — the caller must
 * map null to the same 404 as an unknown id).
 */
export async function loadBookingDocumentPdfModel(
  actor: DocumentAccessActor,
  documentId: string,
  expectedBookingReference: string | null,
  opts: { verificationBaseUrl?: string } = {},
): Promise<PdfDocumentModel | null> {
  const view = await getBookingDocumentForActor(actor, documentId);
  if (!view) return null;
  // Only issued types render; the issuance service is the authority on
  // which types exist, so this stays a sanity check, not a policy list.
  if (!(ISSUABLE_DOCUMENT_TYPES as readonly string[]).includes(view.type)) return null;
  // Owner/staff URLs pin the document to the booking in the path, so a
  // valid id cannot be replayed under another booking's address.
  if (expectedBookingReference !== null && view.bookingReference !== expectedBookingReference) {
    return null;
  }

  const booking = await db.booking.findUnique({
    where: { reference: view.bookingReference },
    select: {
      status: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      notes: true,
      total: true,
      subtotal: true,
      discount: true,
      items: {
        select: {
          tourTitle: true,
          travelDate: true,
          adults: true,
          children: true,
          infants: true,
          addons: true,
          adultUnit: true,
          childUnit: true,
          infantUnit: true,
          addonTotal: true,
          lineTotal: true,
        },
        orderBy: { id: 'asc' },
      },
      payments: {
        select: {
          reference: true,
          provider: true,
          status: true,
          amountPaid: true,
          amountRefunded: true,
          paidAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!booking) return null;

  const lines: PdfLineItem[] = booking.items.map((item) => ({
    title: item.tourTitle,
    travelDate: item.travelDate ? item.travelDate : null,
    adults: item.adults,
    children: item.children,
    infants: item.infants,
    addons: parseAddons(item.addons),
  }));

  const issuerSettings = await getDocumentIssuer();
  const issuer = {
    companyName: issuerSettings.companyName,
    email: issuerSettings.email,
    phone: issuerSettings.phone,
    address: issuerSettings.address,
    legalEntityName: issuerSettings.legalEntityName,
    registrationNumber: issuerSettings.registrationNumber,
    taxNumber: issuerSettings.taxNumber,
    logoData: await resolveLogoData(issuerSettings.logo),
  };

  const paymentSummaries = booking.payments.map((payment) => ({
    status: FROM_DB_PAYMENT_STATUS[payment.status],
    amountPaidCents: decimalToCents(payment.amountPaid),
    amountRefundedCents: decimalToCents(payment.amountRefunded),
    reference: payment.reference,
    createdAt: payment.createdAt,
  }));
  const paidToDateCents = paymentSummaries
    .filter((p) => p.status === 'paid' || p.status === 'partially_refunded' || p.status === 'refunded')
    .reduce((sum, p) => sum + p.amountPaidCents, 0);
  const refundedToDateCents = paymentSummaries.reduce((sum, p) => sum + p.amountRefundedCents, 0);
  const summaryState = deriveBookingPaymentSummary(
    paymentSummaries,
    decimalToCents(booking.total),
  ).state;

  let receipt: PdfDocumentModel['receipt'] = null;
  if (view.type === 'PAYMENT_RECEIPT') {
    const payment = booking.payments.find((p) => p.reference === view.paymentReference) ?? null;
    if (!payment) return null;
    receipt = {
      paymentReference: payment.reference,
      provider: payment.provider,
      paidOn: payment.paidAt ? payment.paidAt.toISOString() : null,
      // Frozen snapshot from the issued document row — never the live payment.
      amountReceivedCents: view.amountCents,
      refundedToDateCents: decimalToCents(payment.amountRefunded),
    };
  }

  let invoice: PdfDocumentModel['invoice'] = null;
  if (view.type === 'INVOICE') {
    // Frozen commercial snapshot: line prices, subtotal, discount and
    // total come from the issuance snapshot. Payments, refunds and
    // the balance due are live and explicitly labeled on the page.
    // The snapshot is authoritative; live item rows are only a
    // defensive fallback that cannot move the frozen money values.
    const lines: PdfInvoiceLine[] =
      view.invoiceLines ??
      booking.items.map((item) =>
        shapeInvoiceLine({
          title: item.tourTitle,
          travelDate: item.travelDate ? item.travelDate : null,
          adults: item.adults,
          children: item.children,
          infants: item.infants,
          adultUnitCents: decimalToCents(item.adultUnit),
          childUnitCents: decimalToCents(item.childUnit),
          infantUnitCents: decimalToCents(item.infantUnit),
          addonTotalCents: decimalToCents(item.addonTotal),
          lineTotalCents: decimalToCents(item.lineTotal),
          addons: parseAddons(item.addons),
        }),
      );
    const invoicePayments = booking.payments
      .filter((payment) => {
        const status = FROM_DB_PAYMENT_STATUS[payment.status];
        return (
          status === 'paid' ||
          status === 'partially_refunded' ||
          status === 'refunded' ||
          decimalToCents(payment.amountPaid) > 0 ||
          decimalToCents(payment.amountRefunded) > 0
        );
      })
      .map((payment) => ({
        reference: payment.reference,
        amountPaidCents: decimalToCents(payment.amountPaid),
        paidOn: payment.paidAt ? payment.paidAt.toISOString() : null,
      }));
    invoice = {
      lines,
      subtotalCents: view.invoiceSnapshot?.subtotalCents ?? decimalToCents(booking.subtotal),
      discountCents: view.invoiceSnapshot?.discountCents ?? decimalToCents(booking.discount),
      totalCents: view.amountCents,
      paymentsToDate: invoicePayments,
      paidToDateCents,
      refundedToDateCents,
      balanceDueCents: view.amountCents - paidToDateCents + refundedToDateCents,
      balanceAsOf: new Date().toISOString(),
    };
  }

  let voucher: PdfDocumentModel['voucher'] = null;
  if (view.type === 'BOOKING_VOUCHER') {
    // No money on a voucher — services plus the verification QR only.
    // The QR encodes the absolute verification URL carrying the
    // purpose-specific opaque token; PDFs stay verifiable at any later
    // download because the token is stored on the document row.
    const base = (opts.verificationBaseUrl ?? '').replace(/\/+$/, '');
    const verificationUrl = view.verificationToken
      ? `${base}/verify-voucher/${view.verificationToken}`
      : '';
    voucher = {
      customerName: booking.contactName,
      services: booking.items.map((item) => ({
        title: item.tourTitle,
        travelDate: item.travelDate ? item.travelDate : null,
        travelers: formatTravelersLabel(item.adults, item.children, item.infants),
        addons: parseAddons(item.addons),
      })),
      verificationUrl,
      qrPng: verificationUrl ? await renderVerificationQr(verificationUrl) : null,
    };
  }

  let refundNote: PdfDocumentModel['refundNote'] = null;
  if (view.type === 'REFUND_NOTE') {
    // Frozen snapshot of the anchored refund event. A note without its
    // snapshot never renders.
    if (!view.refund || !view.paymentReference) return null;
    refundNote = {
      paymentReference: view.paymentReference,
      amountCents: view.refund.amountCents,
      scope: view.refund.scope,
      method: view.refund.method,
      externalReference: view.refund.externalReference,
      refundDate: view.refund.date,
    };
  }

  const hasOwnSection = receipt !== null || invoice !== null || voucher !== null || refundNote !== null;

  return {
    issuer,
    document: {
      number: view.number,
      type: view.type as PdfDocumentType,
      typeLabel: PDF_TYPE_LABELS[view.type as PdfDocumentType],
      issuedAt: view.issuedAt.toISOString(),
      bookingReference: view.bookingReference,
    },
    booking: {
      statusLabel: bookingStatusLabel(booking.status),
      contactName: booking.contactName,
      contactEmail: booking.contactEmail,
      contactPhone: booking.contactPhone,
      notes: booking.notes,
      lines,
      summary: hasOwnSection
        ? null
        : {
              paymentStatus: paymentStatusLabel(summaryState),
              // Historical amount: the document's own snapshot, not the
              // current booking total.
              totalAtIssueCents: view.amountCents,
              paidToDateCents,
              refundedToDateCents,
              remainingCents: Math.max(view.amountCents - paidToDateCents, 0),
              hasPayments: paymentSummaries.length > 0,
            },
    },
    receipt,
    invoice,
    voucher,
    refundNote,
    notice:
      view.type === 'BOOKING_REQUEST'
        ? 'This document confirms receipt of your booking request. It is not a final booking confirmation or payment receipt.'
        : view.type === 'BOOKING_VOUCHER'
          ? 'Present this voucher to our team on the service day. Scan the QR code to verify its validity.'
          : null,
    hideLegalRows:
      view.type === 'INVOICE' || view.type === 'BOOKING_VOUCHER' || view.type === 'REFUND_NOTE',
  };
}

/** `SP-RCPT-2026-000001.pdf` — ASCII-safe by construction, sanitized anyway. */
export function documentPdfFilename(number: string): string {
  const safe = DOCUMENT_NUMBER_PATTERN.test(number)
    ? number
    : String(number).replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 48) || 'document';
  return `${safe}.pdf`;
}

/**
 * Renders the PDF for an issued document the actor may access, or null
 * for every denial (missing document, wrong actor, booking-reference
 * mismatch). Read-only: performs no issuance. `opts.verificationBaseUrl`
 * anchors voucher QR codes to an absolute verification URL.
 */
export async function buildBookingDocumentPdf(
  actor: DocumentAccessActor,
  documentId: string,
  expectedBookingReference: string | null,
  opts: { verificationBaseUrl?: string } = {},
): Promise<BookingDocumentPdfFile | null> {
  const model = await loadBookingDocumentPdfModel(actor, documentId, expectedBookingReference, opts);
  if (!model) return null;
  const bytes = await renderBookingDocumentPdf(model);
  return { bytes, filename: documentPdfFilename(model.document.number), number: model.document.number };
}

const NOT_FOUND_BODY = { error: 'Document not found.' } as const;

/**
 * Maps a download attempt to its HTTP response. Denials are a uniform
 * 404 (identical body and headers as an unknown document id) with
 * `Cache-Control: private, no-store` so nothing shared ever caches a
 * personal document or a probe result.
 */
export function documentPdfResponse(file: BookingDocumentPdfFile | null) {
  if (!file) {
    return new Response(JSON.stringify(NOT_FOUND_BODY), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store',
        Pragma: 'no-cache',
      },
    });
  }
  return new Response(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'private, no-store',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Length': String(file.bytes.length),
    },
  });
}
