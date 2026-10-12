// Phase B: typed content model for issued booking documents. Pure data —
// no database access, no rendering. Tests assert on this model directly,
// which is what guarantees financial accuracy independently of drawing.
//
// Honesty rules encoded in the shape:
// - `booking.summary.totalAtIssueCents` is the amountCents SNAPSHOT stored
//   on the issued document row. It is never recomputed from the live
//   booking, so historical documents stay stable even if the booking's
//   totals change later.
// - `paidTo` / `refundedTo` / payment status are LIVE values and their
//   labels say so ("to date"); they are additive context rows, never a
//   replacement for the snapshot total.
// - `receipt.amountReceivedCents` is the receipt's frozen snapshot of the
//   exact verified payment (the document row's amountCents). The receipt
//   is scoped to its own Payment row; other payments never appear in it.
// - All money is integer USD cents. There is no tax, VAT, or bank block
//   anywhere in this model.
// - Phase D additions follow the same rules: invoice totals, discounts
//   and line prices are frozen booking snapshots; payments, refunds and
//   the balance due are live values explicitly labeled "to date" / "as
//   of". Vouchers carry no money at all. Refund notes freeze the exact
//   anchored refund event (amount, method, external reference, date).
export type PdfDocumentType =
  | 'BOOKING_REQUEST'
  | 'BOOKING_CONFIRMATION'
  | 'PAYMENT_RECEIPT'
  | 'INVOICE'
  | 'BOOKING_VOUCHER'
  | 'REFUND_NOTE';

export interface PdfLineItem {
  title: string;
  /** Raw `YYYY-MM-DD` travel date, or null for open-date trips. */
  travelDate: string | null;
  adults: number;
  children: number;
  infants: number;
  addons: string[];
}

export interface PdfBookingSummary {
  /** English payment status label derived from live Payment rows. */
  paymentStatus: string;
  /** Frozen snapshot from the issued document row. */
  totalAtIssueCents: number;
  /** Live sums across the booking's payments. */
  paidToDateCents: number;
  refundedToDateCents: number;
  /** max(totalAtIssueCents - paidToDateCents, 0) — keeps the shown rows
   * internally consistent with the snapshot total. */
  remainingCents: number;
  hasPayments: boolean;
}

export interface PdfReceiptSummary {
  paymentReference: string;
  /** Payment provider as stored server-side (honest raw value). */
  provider: string;
  /** ISO timestamp of the verified payment, or null when unset. */
  paidOn: string | null;
  /** Frozen at issuance (the document row's amountCents). */
  amountReceivedCents: number;
  /** Live value of that same payment row, shown separately. */
  refundedToDateCents: number;
}

export interface PdfInvoiceLine {
  title: string;
  /** Raw `YYYY-MM-DD` travel date, or null for open-date trips. */
  travelDate: string | null;
  /** Human count line, e.g. `3 (2 adults · 1 child)`. */
  travelers: string;
  /** Frozen unit prices line, or null when the line has no priced units. */
  unitPrices: string | null;
  /** Frozen line total in cents. */
  lineTotalCents: number;
  addons: string[];
}

export interface PdfInvoicePayment {
  reference: string;
  amountPaidCents: number;
  /** ISO timestamp or null. */
  paidOn: string | null;
}

/** Frozen invoice snapshot envelope (lines plus subtotal/discount). */
export interface PdfInvoiceSnapshot {
  subtotalCents: number;
  discountCents: number;
  lines: PdfInvoiceLine[];
}

export interface PdfInvoiceDetails {
  /** Frozen booking snapshots at issuance (never recomputed). */
  lines: PdfInvoiceLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  /** Live verified payments, labeled "to date" on the page. */
  paymentsToDate: PdfInvoicePayment[];
  paidToDateCents: number;
  refundedToDateCents: number;
  /** totalCents - paidToDateCents + refundedToDateCents, labeled "as of". */
  balanceDueCents: number;
  /** ISO timestamp the live balance was computed at. */
  balanceAsOf: string;
}

export interface PdfVoucherService {
  title: string;
  /** Raw `YYYY-MM-DD` travel date, or null for open-date trips. */
  travelDate: string | null;
  travelers: string;
  addons: string[];
}

export interface PdfVoucherDetails {
  customerName: string;
  services: PdfVoucherService[];
  /** Absolute verification URL encoded in the QR (and printed below it). */
  verificationUrl: string;
  /** Rendered QR PNG bytes, or null when generation failed. */
  qrPng: Buffer | null;
}

export interface PdfRefundDetails {
  paymentReference: string;
  /** Frozen at issuance from the anchored refund event. */
  amountCents: number;
  scope: 'full' | 'partial';
  /** Raw stored method (`bank_transfer` / `cash`). */
  method: string;
  externalReference: string;
  /** ISO date of the completed refund, frozen at issuance. */
  refundDate: string;
}

export interface PdfIssuerBlock {
  companyName: string;
  email: string;
  phone: string;
  address: string;
  /** Optional legal identity. `null` means "not provided" and is never
   * rendered. No VAT or bank fields exist in this block at all. */
  legalEntityName: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  /** Local brand logo bytes when resolvable; null renders a wordmark. */
  logoData: Buffer | null;
}

export interface PdfDocumentModel {
  issuer: PdfIssuerBlock;
  document: {
    number: string;
    type: PdfDocumentType;
    typeLabel: string;
    /** ISO issue timestamp of the document row. */
    issuedAt: string;
    bookingReference: string;
  };
  booking: {
    /** English status label for the booking at render time. */
    statusLabel: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    notes: string | null;
    lines: PdfLineItem[];
    /** Null for receipts — receipts are payment-scoped, not booking-priced. */
    summary: PdfBookingSummary | null;
  };
  /** Set only for PAYMENT_RECEIPT. */
  receipt: PdfReceiptSummary | null;
  /** Set only for INVOICE. Replaces `booking.summary`. */
  invoice: PdfInvoiceDetails | null;
  /** Set only for BOOKING_VOUCHER. Replaces `booking.summary`. */
  voucher: PdfVoucherDetails | null;
  /** Set only for REFUND_NOTE. Replaces `booking.summary`. */
  refundNote: PdfRefundDetails | null;
    /** Honesty notice shown on the document (booking requests and vouchers). */
  notice: string | null;
  /**
   * Phase D documents never show registration/tax/legal rows, even when
   * configured. The original three layouts keep their behavior.
   */
  hideLegalRows: boolean;
}

export const PDF_TYPE_LABELS: Record<PdfDocumentType, string> = {
  BOOKING_REQUEST: 'Booking Request',
  BOOKING_CONFIRMATION: 'Booking Confirmation',
  PAYMENT_RECEIPT: 'Payment Receipt',
  INVOICE: 'Commercial Invoice',
  BOOKING_VOUCHER: 'Booking Voucher',
  REFUND_NOTE: 'Refund Note',
};

/**
 * Formats integer USD cents as `USD 1,234.56` using integer arithmetic
 * only (no float money math), matching the project's cents convention.
 */
export function formatUsdAmount(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(Math.trunc(cents));
  const whole = Math.floor(absolute / 100).toLocaleString('en-US');
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${sign}USD ${whole}.${fraction}`;
}

/** `2026-10-12T09:30:00.000Z` -> `12 Oct 2026` (UTC, English). */
export function formatUtcDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** English booking-status labels (mirrors the print document's mapping). */
export function bookingStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Request received';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
}

/** `3 (2 adults · 1 child)` style traveler count line. */
export function formatTravelersLabel(adults: number, children: number, infants: number): string {
  const total = adults + children + infants;
  const parts = [`${adults} adult${adults === 1 ? '' : 's'}`];
  if (children > 0) parts.push(`${children} child${children === 1 ? '' : 'ren'}`);
  if (infants > 0) parts.push(`${infants} infant${infants === 1 ? '' : 's'}`);
  return `${total} (${parts.join(' · ')})`;
}

export interface RawInvoiceLineInput {
  title: string;
  travelDate: string | null;
  adults: number;
  children: number;
  infants: number;
  adultUnitCents: number;
  childUnitCents: number;
  infantUnitCents: number;
  addonTotalCents: number;
  lineTotalCents: number;
  addons: string[];
}

/**
 * Shapes one frozen invoice line from integer cents. Shared by the
 * issuance snapshot and the PDF assembly so both read identically.
 */
export function shapeInvoiceLine(input: RawInvoiceLineInput): PdfInvoiceLine {
  const unitParts: string[] = [];
  if (input.adults > 0 && input.adultUnitCents > 0) {
    unitParts.push(
      `${formatUsdAmount(input.adultUnitCents)} × ${input.adults} adult${input.adults === 1 ? '' : 's'}`,
    );
  }
  if (input.children > 0 && input.childUnitCents > 0) {
    unitParts.push(
      `${formatUsdAmount(input.childUnitCents)} × ${input.children} child${input.children === 1 ? '' : 'ren'}`,
    );
  }
  if (input.infants > 0 && input.infantUnitCents > 0) {
    unitParts.push(
      `${formatUsdAmount(input.infantUnitCents)} × ${input.infants} infant${input.infants === 1 ? '' : 's'}`,
    );
  }
  if (input.addonTotalCents > 0) {
    unitParts.push(`Add-ons ${formatUsdAmount(input.addonTotalCents)}`);
  }
  return {
    title: input.title,
    travelDate: input.travelDate,
    travelers: formatTravelersLabel(input.adults, input.children, input.infants),
    unitPrices: unitParts.length > 0 ? unitParts.join(' · ') : null,
    lineTotalCents: input.lineTotalCents,
    addons: input.addons,
  };
}

/** English refund-method labels for the stored offline method values. */
export function refundMethodLabel(method: string): string {
  switch (method) {
    case 'bank_transfer':
      return 'Bank transfer';
    case 'cash':
      return 'Cash';
    default:
      return method;
  }
}

/** English payment-status labels for `deriveBookingPaymentSummary` states. */
export function paymentStatusLabel(state: string): string {
  switch (state) {
    case 'unpaid':
    case 'pending':
      return 'Awaiting payment';
    case 'processing':
      return 'Processing';
    case 'failed':
      return 'Payment failed';
    case 'paid':
      return 'Fully paid';
    case 'partially_refunded':
      return 'Partially refunded';
    case 'refunded':
      return 'Refunded';
    default:
      return state;
  }
}
