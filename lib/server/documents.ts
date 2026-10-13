// Booking documents foundation (Phase A).
//
// This module owns database-backed document numbering and explicit,
// idempotent document issuance for future booking documents. It is a
// FOUNDATION: nothing in the application calls `issueBookingDocument`
// automatically — no checkout, payment transition, webhook, email, or
// notification path issues a document. Booking requests, confirmations
// and receipts on the existing print view keep working exactly as
// before; that print-only component is untouched by this phase.
//
// Honesty rules baked into this module:
// - Document numbers live in their OWN namespace (`SP-<TYPE>-<year>-<seq>`).
//   Booking references (`SP-BK-*`) and payment references (`SP-PAY-*`) are
//   never renumbered, reused, or rewritten here.
// - Money is USD-only (the accounting currency) and stored as integer
//   cents snapshotted from verified Payment rows (`amountPaid`) or the
//   server-computed booking total. There is no tax, VAT, or invoice-total
//   modeling: legal configuration does not exist yet, and this module
//   never fabricates a legal entity name, registration number, tax
//   number, or VAT rate.
// - Proof submissions are BookingActivity rows, never Payment rows; a
//   proof can therefore never produce a receipt. Only settled money on a
//   Payment row (`amountPaid > 0`) qualifies a PAYMENT_RECEIPT.
// - INVOICE, REFUND_NOTE and BOOKING_VOUCHER exist as named types only
//   and stay blocked until their business rules are defined. No invoice
//   is ever issued automatically or at all in this phase.
//
// Security model for future downloads:
// - There is NO HTTP route and NO public document URL in this phase.
//   When download routes are added they MUST resolve access through
//   `getBookingDocumentForActor`, which encodes the three legitimate
//   audiences: the booking owner (server session), staff holding
//   `bookings.view` or `payments.view`, and a guest holding a valid
//   booking-access token for that exact booking. Every other request
//   gets the same `null` (mapped to a uniform 404 by the future route).
// - A document number is not a credential, and guest tokens are never
//   stored in or next to document rows.
import 'server-only';

import { Prisma, type BookingDocumentType } from '@prisma/client';

import { COMPANY_ADDRESS, COMPANY_EMAIL, COMPANY_PHONE_DISPLAY } from '@/data/company';

import { GuestBookingAccessError, resolveGuestBookingToken } from './booking-access';
import { hasPermission } from './auth';
import { db } from './db';
import { getSetting } from './settings';
import type { PublicUser } from './users';
import { generateOpaqueToken } from '../core/tokens';
import type { DocumentListItem } from '../documents';
import { shapeInvoiceLine, type PdfInvoiceLine, type PdfInvoiceSnapshot } from './pdf/model';

/** Accounting currency for every document. EUR/EGP stay presentation-only. */
export const DOCUMENT_CURRENCY = 'USD' as const;

/** Number format: `SP-RCPT-2026-000001`. Human-facing, never a credential. */
export const DOCUMENT_NUMBER_PATTERN =
  /^SP-(BRQ|BCF|RCPT|INV|RFD|VCH)-\d{4}-\d{6}$/;

const TYPE_PREFIX: Record<BookingDocumentType, string> = {
  BOOKING_REQUEST: 'SP-BRQ',
  BOOKING_CONFIRMATION: 'SP-BCF',
  PAYMENT_RECEIPT: 'SP-RCPT',
  INVOICE: 'SP-INV',
  REFUND_NOTE: 'SP-RFD',
  BOOKING_VOUCHER: 'SP-VCH',
};

/**
 * Types the service will issue. Phase D completed the set: commercial
 * invoices, booking vouchers and refund notes joined the original three
 * under the same numbering, idempotency and snapshot rules. Nothing is
 * ever issued automatically — every type requires an explicit,
 * permission-gated staff call.
 */
export const ISSUABLE_DOCUMENT_TYPES = [
  'BOOKING_REQUEST',
  'BOOKING_CONFIRMATION',
  'PAYMENT_RECEIPT',
  'INVOICE',
  'BOOKING_VOUCHER',
  'REFUND_NOTE',
] as const;

export type IssuableDocumentType = (typeof ISSUABLE_DOCUMENT_TYPES)[number];

/**
 * Reserved-type list, kept for import compatibility. Empty since
 * Phase D: every named type is issuable under its own business rules.
 */
export const NOT_YET_ISSUABLE_DOCUMENT_TYPES: readonly BookingDocumentType[] = [];

export interface RefundDocumentSnapshot {
  eventId: string;
  amountCents: number;
  method: string;
  externalReference: string;
  /** ISO date of the completed refund, frozen at issuance. */
  date: string;
  /** From the anchored event: full or partial refund. */
  scope: 'full' | 'partial';
}

export interface BookingDocumentView {
  id: string;
  number: string;
  type: BookingDocumentType;
  bookingReference: string;
  paymentReference: string | null;
  amountCents: number;
  currency: typeof DOCUMENT_CURRENCY;
  issuedAt: Date;
  /** Raw opaque voucher-verification token. Set only on vouchers. */
  verificationToken: string | null;
  /** Frozen refund snapshot. Set only on refund notes. */
  refund: RefundDocumentSnapshot | null;
  /** Frozen invoice snapshot (lines plus subtotal/discount). Set only on invoices. */
  invoiceSnapshot: PdfInvoiceSnapshot | null;
  /** Frozen invoice service lines (convenience view of the snapshot). */
  invoiceLines: PdfInvoiceLine[] | null;
}

export interface IssueBookingDocumentInput {
  type: IssuableDocumentType;
  bookingReference: string;
  /** Required for PAYMENT_RECEIPT and REFUND_NOTE; rejected otherwise. */
  paymentReference?: string;
  /** Required for REFUND_NOTE: the persisted completed-refund event. */
  refundEventId?: string;
  /** Caller-scoped per logical document, e.g. `receipt:SP-PAY-ABC123`. */
  idempotencyKey: string;
}

export type IssueBookingDocumentFailure =
  | 'invalid-input'
  | 'not-issuable-yet'
  | 'unknown-booking'
  | 'unknown-payment'
  | 'payment-not-on-booking'
  | 'status-mismatch'
  | 'no-verified-money'
  | 'non-usd-payment'
  | 'unknown-refund-event'
  | 'refund-not-on-booking'
  | 'refund-not-tracked'
  | 'duplicate-refund-note'
  | 'duplicate-invoice'
  | 'duplicate-voucher'
  | 'voucher-not-eligible'
  | 'invoice-not-eligible';

export type IssueBookingDocumentResult =
  | { ok: true; created: boolean; document: BookingDocumentView }
  | { ok: false; error: IssueBookingDocumentFailure };

/** Same private-conversion convention as payments.ts / bookings.ts. */
function decimalToCents(value: Prisma.Decimal | number | string): number {
  return Math.round(Number(value.toString()) * 100);
}

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function formatDocumentNumber(
  type: BookingDocumentType,
  year: number,
  sequence: number,
): string {
  return `${TYPE_PREFIX[type]}-${year}-${String(sequence).padStart(6, '0')}`;
}

type DocumentRow = Prisma.BookingDocumentGetPayload<{
  select: {
    id: true;
    number: true;
    type: true;
    amountCents: true;
    currency: true;
    issuedAt: true;
    booking: { select: { reference: true } };
    payment: { select: { reference: true } };
  };
}>;

function toDocumentView(
  row: DocumentRow,
  ext?: DocumentExtensionRow | null,
  refundScope?: 'full' | 'partial' | null,
): BookingDocumentView {
  const refund =
    row.type === 'REFUND_NOTE' &&
    ext?.refundEventId &&
    ext.refundAmountCents != null &&
    refundScope
      ? {
          eventId: ext.refundEventId,
          amountCents: ext.refundAmountCents,
          method: ext.refundMethod ?? '',
          externalReference: ext.refundExternalReference ?? '',
          date: (ext.refundDate ?? row.issuedAt).toISOString(),
          scope: refundScope,
        }
      : null;
  return {
    id: row.id,
    number: row.number,
    type: row.type,
    bookingReference: row.booking.reference,
    paymentReference: row.payment?.reference ?? null,
    amountCents: row.amountCents,
    currency: DOCUMENT_CURRENCY,
    issuedAt: row.issuedAt,
    verificationToken: ext?.verificationToken ?? null,
    refund,
    invoiceSnapshot: row.type === 'INVOICE' ? parseInvoiceSnapshot(ext?.lineSnapshot ?? null) : null,
    invoiceLines: row.type === 'INVOICE' ? parseInvoiceSnapshot(ext?.lineSnapshot ?? null)?.lines ?? null : null,
  };
}

/** Frozen invoice snapshot envelope (server-written JSON). */
function parseInvoiceSnapshot(raw: string | null): PdfInvoiceSnapshot | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const envelope = parsed as Record<string, unknown>;
    if (typeof envelope.subtotalCents !== 'number' || typeof envelope.discountCents !== 'number') {
      return null;
    }
    const lines = parseInvoiceLines(envelope.lines);
    if (!lines) return null;
    return { subtotalCents: envelope.subtotalCents, discountCents: envelope.discountCents, lines };
  } catch {
    return null;
  }
}

/** Defensive validation of decoded invoice lines (server-written JSON). */
function parseInvoiceLines(parsed: unknown): PdfInvoiceLine[] | null {
  try {
    if (!Array.isArray(parsed)) return null;
    const lines: PdfInvoiceLine[] = [];
    for (const entry of parsed) {
      if (typeof entry !== 'object' || entry === null) return null;
      const candidate = entry as Record<string, unknown>;
      if (
        typeof candidate.title !== 'string' ||
        typeof candidate.travelers !== 'string' ||
        typeof candidate.lineTotalCents !== 'number'
      ) {
        return null;
      }
      lines.push({
        title: candidate.title,
        travelDate: typeof candidate.travelDate === 'string' ? candidate.travelDate : null,
        travelers: candidate.travelers,
        unitPrices: typeof candidate.unitPrices === 'string' ? candidate.unitPrices : null,
        lineTotalCents: candidate.lineTotalCents,
        addons: Array.isArray(candidate.addons)
          ? candidate.addons.filter((addon): addon is string => typeof addon === 'string')
          : [],
      });
    }
    return lines;
  } catch {
    return null;
  }
}

const DOCUMENT_VIEW_SELECT = {
  id: true,
  number: true,
  type: true,
  amountCents: true,
  currency: true,
  issuedAt: true,
  booking: { select: { reference: true } },
  payment: { select: { reference: true } },
} satisfies Prisma.BookingDocumentSelect;

async function toFullDocumentView(
  client: Prisma.TransactionClient | typeof db,
  row: DocumentRow,
): Promise<BookingDocumentView> {
  const extensions = await readDocumentExtensions(client, [row.id]);
  const ext = extensions.get(row.id) ?? null;
  return toDocumentView(row, ext, ext ? refundEventScope(ext.refundAction) : null);
}

async function loadDocumentView(
  client: Prisma.TransactionClient | typeof db,
  documentId: string,
): Promise<BookingDocumentView | null> {
  const row = await client.bookingDocument.findUnique({
    where: { id: documentId },
    select: DOCUMENT_VIEW_SELECT,
  });
  if (!row) return null;
  return toFullDocumentView(client, row);
}

/**
 * Phase D columns are invisible to the running Prisma Client build
 * (generated before the migration), so they travel through fully
 * parameterized raw SQL until the client is regenerated. Table and
 * column names are fixed identifiers — no user input ever reaches
 * them; every value is bound.
 */
interface DocumentExtensionRow {
  id: string;
  verificationToken: string | null;
  refundEventId: string | null;
  refundAmountCents: number | null;
  refundMethod: string | null;
  refundExternalReference: string | null;
  refundDate: Date | null;
  refundAction: string | null;
  lineSnapshot: string | null;
}

async function readDocumentExtensions(
  client: Prisma.TransactionClient | typeof db,
  documentIds: string[],
): Promise<Map<string, DocumentExtensionRow>> {
  const extensions = new Map<string, DocumentExtensionRow>();
  if (documentIds.length === 0) return extensions;
  const rows = await client.$queryRaw<DocumentExtensionRow[]>`
    SELECT d.id, d.verificationToken, d.refundEventId, d.refundAmountCents,
           d.refundMethod, d.refundExternalReference, d.refundDate,
           d.lineSnapshot, e.action AS refundAction
    FROM booking_documents AS d
    LEFT JOIN payment_events AS e ON e.id = d.refundEventId
    WHERE d.id IN (${Prisma.join(documentIds)})`;
  for (const row of rows) extensions.set(row.id, row);
  return extensions;
}

/** Refund-completion vocabulary shared with the payments module. */
function refundEventScope(action: string | null | undefined): 'full' | 'partial' | null {
  if (action === 'Payment refunded') return 'full';
  if (action === 'Payment partially refunded') return 'partial';
  return null;
}

function isUniqueViolation(error: unknown, field: string): boolean {
  // Duck-typed on purpose: the error class identity differs between the
  // CJS/ESM client builds, but every P2002 carries `code` + `meta.target`.
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; meta?: { target?: unknown } };
  if (candidate.code !== 'P2002') return false;
  const target = candidate.meta?.target;
  if (typeof target === 'string') return target.includes(field);
  if (Array.isArray(target)) return target.some((entry) => String(entry).includes(field));
  return false;
}

function isRetryableConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; message?: unknown };
  // P2034: Prisma's label for deadlocks / write conflicts; MySQL 1213 /
  // 40001 also appear in the message text on some client builds.
  if (candidate.code === 'P2034') return true;
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  return message.includes('1213') || /deadlock/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates the year's counter row OUTSIDE the issuing transaction (a
 * no-op when it already exists), so the transaction itself only takes
 * the plain row lock of an UPDATE. Concurrency-safe: racing creators
 * collapse on the primary key; the loser ignores the duplicate.
 */
async function ensureSequenceRow(type: BookingDocumentType, year: number): Promise<string> {
  const key = `${type}:${year}`;
  try {
    await db.documentSequence.upsert({
      where: { key },
      update: {},
      create: { key, lastValue: 0 },
    });
  } catch (error) {
    if (!isUniqueViolation(error, 'key')) throw error;
  }
  return key;
}

/**
 * Allocates the next sequence number for a pre-created counter row
 * inside the issuing transaction. The atomic `lastValue + 1` UPDATE
 * takes the row lock for the rest of the transaction, so concurrent
 * issuances serialize and each caller reads back its own distinct
 * value. Gaps are possible when a losing transaction aborts — numbers
 * are consumed, never duplicated.
 */
async function allocateSequence(
  tx: Prisma.TransactionClient,
  sequenceKey: string,
): Promise<number> {
  await tx.$executeRaw`UPDATE document_sequences SET lastValue = lastValue + 1 WHERE \`key\` = ${sequenceKey}`;
  const rows = await tx.$queryRaw<Array<{ lastValue: number }>>`SELECT lastValue FROM document_sequences WHERE \`key\` = ${sequenceKey}`;
  const value = rows?.[0]?.lastValue;
  if (!Number.isInteger(value)) {
    throw new Error('Could not allocate a document number. Please try again.');
  }
  return value;
}

/** Defensive parse of the JSON-text add-ons column for snapshots. */
function parseItemAddons(raw: string): string[] {
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

/**
 * Thrown inside the issuing transaction when a guarded document turns
 * out to already exist: one invoice / voucher per booking, one note per
 * refund event. Surfaced as a 409 failure, never a second document.
 */
export class DuplicateDocumentError extends Error {
  constructor(
    readonly failure: 'duplicate-invoice' | 'duplicate-voucher' | 'duplicate-refund-note',
  ) {
    super(failure);
    this.name = 'DuplicateDocumentError';
  }
}

interface RefundEventDetail {
  id: string;
  paymentId: string;
  paymentReference: string;
  paymentBookingId: string;
  action: string;
  amountCents: number | null;
  method: string | null;
  externalReference: string | null;
  createdAt: Date;
}

/** Loads one refund event with its payment linkage, or null. */
async function loadRefundEvent(eventId: string): Promise<RefundEventDetail | null> {
  const rows = await db.$queryRaw<RefundEventDetail[]>`
    SELECT e.id, e.paymentId, p.reference AS paymentReference,
           p.bookingId AS paymentBookingId, e.action, e.amountCents,
           e.method, e.externalReference, e.createdAt
    FROM payment_events AS e
    JOIN payments AS p ON p.id = e.paymentId
    WHERE e.id = ${eventId}
    LIMIT 1`;
  return rows[0] ?? null;
}

async function findRefundNoteForEvent(eventId: string): Promise<string | null> {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM booking_documents
    WHERE refundEventId = ${eventId} AND type = 'REFUND_NOTE'
    LIMIT 1`;
  return rows[0]?.id ?? null;
}

async function hasBookingDocumentOfType(
  bookingId: string,
  type: BookingDocumentType,
): Promise<boolean> {
  const existing = await db.bookingDocument.findFirst({
    where: { bookingId, type },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Explicitly issues one document for one booking. Idempotent per
 * `idempotencyKey`: a retry (sequential or racing) returns the original
 * document with its original number instead of minting a second one.
 * Never rewrites the booking, its payments, or their references, and
 * performs no emails, notifications, or other side effects.
 */
export async function issueBookingDocument(
  input: IssueBookingDocumentInput,
): Promise<IssueBookingDocumentResult> {
  const type = input.type;
  if (!(ISSUABLE_DOCUMENT_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: 'not-issuable-yet' };
  }

  const idempotencyKey =
    typeof input.idempotencyKey === 'string' ? input.idempotencyKey.trim() : '';
  if (
    idempotencyKey.length < 8 ||
    idempotencyKey.length > 120 ||
    hasControlChars(idempotencyKey)
  ) {
    return { ok: false, error: 'invalid-input' };
  }

  const bookingReference =
    typeof input.bookingReference === 'string' ? input.bookingReference.trim() : '';
  if (!bookingReference) return { ok: false, error: 'invalid-input' };

  const paymentReference =
    typeof input.paymentReference === 'string' ? input.paymentReference.trim() : '';
  const refundEventId =
    typeof input.refundEventId === 'string' ? input.refundEventId.trim() : '';

  // Idempotent fast path: an existing document for this key is returned
  // as-is, with its original number — never renumbered or recreated.
  const existing = await db.bookingDocument.findUnique({
    where: { idempotencyKey },
    select: DOCUMENT_VIEW_SELECT,
  });
  if (existing) return { ok: true, created: false, document: await toFullDocumentView(db, existing) };

  const booking = await db.booking.findUnique({
    where: { reference: bookingReference },
    select: { id: true, reference: true, status: true, currency: true, total: true, subtotal: true, discount: true },
  });
  if (!booking) return { ok: false, error: 'unknown-booking' };

  let paymentId: string | null = null;
  let amountCents: number;
  let verificationToken: string | null = null;
  let lineSnapshot: string | null = null;
  let refundSnapshot: {
    eventId: string;
    amountCents: number;
    method: string;
    externalReference: string;
    date: Date;
  } | null = null;

  if (type === 'PAYMENT_RECEIPT') {
    if (!paymentReference || refundEventId) return { ok: false, error: 'invalid-input' };
    const payment = await db.payment.findUnique({
      where: { reference: paymentReference },
      select: { id: true, bookingId: true, currency: true, amountPaid: true },
    });
    if (!payment) return { ok: false, error: 'unknown-payment' };
    if (payment.bookingId !== booking.id) {
      return { ok: false, error: 'payment-not-on-booking' };
    }
    if (payment.currency !== DOCUMENT_CURRENCY) {
      return { ok: false, error: 'non-usd-payment' };
    }
    // Verified money only: `amountPaid` is written exclusively by
    // server-side transitions. Pending/failed payments and proof
    // submissions (which create activities, not payments) stay at 0.
    amountCents = decimalToCents(payment.amountPaid);
    if (amountCents <= 0) return { ok: false, error: 'no-verified-money' };
    paymentId = payment.id;
  } else if (type === 'REFUND_NOTE') {
    // A refund note anchors to exactly one persisted completed-refund
    // event — never to an aggregate refunded total. The event's own
    // per-refund evidence (amount, method, external reference) becomes
    // the frozen snapshot; historical events without that evidence are
    // refused instead of reinterpreted.
    if (!paymentReference || !refundEventId) return { ok: false, error: 'invalid-input' };
    const event = await loadRefundEvent(refundEventId);
    if (!event) return { ok: false, error: 'unknown-refund-event' };
    if (event.paymentBookingId !== booking.id || event.paymentReference !== paymentReference) {
      return { ok: false, error: 'refund-not-on-booking' };
    }
    const scope = refundEventScope(event.action);
    if (
      scope === null ||
      event.amountCents == null ||
      event.amountCents <= 0 ||
      !event.method ||
      !event.externalReference
    ) {
      return { ok: false, error: 'refund-not-tracked' };
    }
    if (await findRefundNoteForEvent(refundEventId)) {
      return { ok: false, error: 'duplicate-refund-note' };
    }
    paymentId = event.paymentId;
    amountCents = event.amountCents;
    refundSnapshot = {
      eventId: event.id,
      amountCents: event.amountCents,
      method: event.method,
      externalReference: event.externalReference,
      date: event.createdAt,
    };
  } else {
    if (paymentReference || refundEventId) return { ok: false, error: 'invalid-input' };
    if (booking.currency !== DOCUMENT_CURRENCY) {
      return { ok: false, error: 'non-usd-payment' };
    }
    if (
      type === 'BOOKING_CONFIRMATION' &&
      booking.status !== 'CONFIRMED' &&
      booking.status !== 'COMPLETED'
    ) {
      return { ok: false, error: 'status-mismatch' };
    }
    if (
      type === 'BOOKING_VOUCHER' &&
      booking.status !== 'CONFIRMED' &&
      booking.status !== 'COMPLETED'
    ) {
      // A voucher is presented as a service entitlement: pending and
      // cancelled bookings are never voucher-eligible. Cancellation
      // after issuance is caught live at verification time.
      return { ok: false, error: 'voucher-not-eligible' };
    }
    if (type === 'INVOICE' && booking.status === 'CANCELLED') {
      // A cancelled booking never receives a NEW invoice. Invoices
      // issued before cancellation are preserved untouched.
      return { ok: false, error: 'invoice-not-eligible' };
    }
    if (type === 'INVOICE' && (await hasBookingDocumentOfType(booking.id, 'INVOICE'))) {
      return { ok: false, error: 'duplicate-invoice' };
    }
    if (type === 'BOOKING_VOUCHER' && (await hasBookingDocumentOfType(booking.id, 'BOOKING_VOUCHER'))) {
      return { ok: false, error: 'duplicate-voucher' };
    }
    if (type === 'INVOICE') {
      // Freeze the service lines from the authoritative booking-item
      // snapshots, so later item changes can never move historical
      // invoice values. Item rows are write-once by every app flow;
      // this JSON is the invoice's own immutable copy.
      const items = await db.bookingItem.findMany({
        where: { bookingId: booking.id },
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
      });
      const snapshot: PdfInvoiceSnapshot = {
        subtotalCents: decimalToCents(booking.subtotal),
        discountCents: decimalToCents(booking.discount),
        lines: items.map((item) =>
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
            addons: parseItemAddons(item.addons),
          }),
        ),
      };
      lineSnapshot = JSON.stringify(snapshot);
    }
    if (type === 'BOOKING_VOUCHER') {
      // Raw opaque token: the QR encodes the verification URL carrying
      // it, and PDFs must stay verifiable at any later download, so the
      // token itself is stored (it authorizes only the minimal public
      // validity view, never private booking data).
      verificationToken = generateOpaqueToken();
    }
    // Snapshot of the server-computed booking total at issuance. For
    // vouchers this is reference context only — money never appears on
    // the voucher, and issuance is never proof of payment.
    amountCents = decimalToCents(booking.total);
  }

  const year = new Date().getUTCFullYear();
  const sequenceKey = await ensureSequenceRow(type, year);
  let attempts = 0;
  for (;;) {
    attempts += 1;
    try {
      const outcome = await db.$transaction(
        async (tx) => {
          const dup = await tx.bookingDocument.findUnique({
            where: { idempotencyKey },
            select: { id: true },
          });
          if (dup) return { id: dup.id, created: false };
          if (type === 'INVOICE' || type === 'BOOKING_VOUCHER' || type === 'REFUND_NOTE') {
            // Guarded types allow only one document per booking (invoice,
            // voucher) or per refund event (note). The pre-transaction
            // checks above are advisory: lock the booking row and
            // re-check inside the transaction so concurrent issuances
            // serialize instead of minting duplicates. The re-checks are
            // locking reads (`FOR UPDATE`): under REPEATABLE READ a plain
            // SELECT would reuse the transaction snapshot and miss a
            // concurrently committed row.
            await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${booking.id} FOR UPDATE`;
            if (type === 'REFUND_NOTE' && refundSnapshot) {
              const existingNote = await tx.$queryRaw<Array<{ id: string }>>`
                SELECT id FROM booking_documents
                WHERE refundEventId = ${refundSnapshot.eventId} AND type = 'REFUND_NOTE'
                LIMIT 1 FOR UPDATE`;
              if (existingNote.length > 0) throw new DuplicateDocumentError('duplicate-refund-note');
            } else {
              const guarded = await tx.$queryRaw<Array<{ id: string }>>`
                SELECT id FROM booking_documents
                WHERE bookingId = ${booking.id} AND type = ${type}
                LIMIT 1 FOR UPDATE`;
              if (guarded.length > 0) {
                throw new DuplicateDocumentError(
                  type === 'INVOICE' ? 'duplicate-invoice' : 'duplicate-voucher',
                );
              }
            }
          }
          const sequence = await allocateSequence(tx, sequenceKey);
          const row = await tx.bookingDocument.create({
            data: {
              number: formatDocumentNumber(type, year, sequence),
              type,
              bookingId: booking.id,
              paymentId,
              amountCents,
              currency: DOCUMENT_CURRENCY,
              idempotencyKey,
            },
            select: { id: true },
          });
          // Phase D extension columns (invisible to the running Prisma
          // Client build): written in the same transaction, so the
          // snapshot and the document row commit atomically.
          if (verificationToken) {
            await tx.$executeRaw`
              UPDATE booking_documents SET verificationToken = ${verificationToken} WHERE id = ${row.id}`;
          }
          if (lineSnapshot) {
            await tx.$executeRaw`
              UPDATE booking_documents SET lineSnapshot = ${lineSnapshot} WHERE id = ${row.id}`;
          }
          if (refundSnapshot) {
            await tx.$executeRaw`
              UPDATE booking_documents
              SET refundEventId = ${refundSnapshot.eventId},
                  refundAmountCents = ${refundSnapshot.amountCents},
                  refundMethod = ${refundSnapshot.method},
                  refundExternalReference = ${refundSnapshot.externalReference},
                  refundDate = ${refundSnapshot.date}
              WHERE id = ${row.id}`;
          }
          return { id: row.id, created: true };
        },
        { maxWait: 10_000, timeout: 20_000 },
      );
      const document = await loadDocumentView(db, outcome.id);
      if (!document) return { ok: false, error: 'invalid-input' };
      return { ok: true, created: outcome.created, document };
    } catch (error) {
      // Guarded-type race lost inside the transaction: surface the
      // duplicate as a failure, never a second document.
      if (error instanceof DuplicateDocumentError) {
        return { ok: false, error: error.failure };
      }
      // Racing retry with the same key: absorb it and return the winner.
      if (isUniqueViolation(error, 'idempotencyKey')) {
        const winner = await db.bookingDocument.findUnique({
          where: { idempotencyKey },
          select: DOCUMENT_VIEW_SELECT,
        });
        if (winner) return { ok: true, created: false, document: await toFullDocumentView(db, winner) };
        return { ok: false, error: 'invalid-input' };
      }
      // Verification-token collision (theoretical at 256 bits):
      // regenerate and re-run, which reallocates number and token.
      if (isUniqueViolation(error, 'verificationToken') && verificationToken && attempts < 3) {
        verificationToken = generateOpaqueToken();
        continue;
      }
      // Number collision (theoretical, given the locked counter):
      // re-run the whole transaction, which reallocates.
      if (isUniqueViolation(error, 'number') && attempts < 3) continue;
      // Deadlock/write-conflict under concurrency: the whole transaction
      // rolled back safely, so re-running it is always correct.
      if (isRetryableConflict(error) && attempts < 5) {
        await sleep(25 * attempts);
        continue;
      }
      throw error;
    }
  }
}

const LEGAL_SETTING_KEYS = {
  legalEntityName: 'company.legalEntityName',
  registrationNumber: 'company.registrationNumber',
  taxNumber: 'company.taxNumber',
} as const;

/** Empty or missing becomes `null` — documents omit unconfigured fields. */
function orNull(value: string | null): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : null;
}

export interface DocumentIssuerInfo {
  companyName: string;
  logo: string;
  email: string;
  phone: string;
  address: string;
  /** Optional legal identity. `null` until real data is configured. */
  legalEntityName: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
}

/**
 * Issuer block for future documents, composed from the DB-backed brand
 * settings (same source as the storefront) with the established static
 * company constants as fallbacks for contact fields. Legal fields have
 * NO fallback: `null` means "not provided" and must stay off documents.
 * There is deliberately no VAT rate, tax id, or bank-details field —
 * none is configured anywhere in the product.
 */
export async function getDocumentIssuer(): Promise<DocumentIssuerInfo> {
  const [
    siteName,
    logo,
    email,
    phone,
    address,
    legalEntityName,
    registrationNumber,
    taxNumber,
  ] = await Promise.all([
    getSetting('site.name'),
    getSetting('site.logo'),
    getSetting('contact.email'),
    getSetting('contact.phone'),
    getSetting('contact.address'),
    getSetting(LEGAL_SETTING_KEYS.legalEntityName),
    getSetting(LEGAL_SETTING_KEYS.registrationNumber),
    getSetting(LEGAL_SETTING_KEYS.taxNumber),
  ]);
  return {
    // Mirrors the client-side default in defaultBrandSettings
    // (lib/admin-store.ts); used only when no site.name row exists.
    companyName: siteName?.trim() || 'Star Pyramids Tours',
    logo: logo?.trim() || '',
    email: email?.trim() || COMPANY_EMAIL,
    phone: phone?.trim() || COMPANY_PHONE_DISPLAY,
    address: address?.trim() || COMPANY_ADDRESS,
    legalEntityName: orNull(legalEntityName),
    registrationNumber: orNull(registrationNumber),
    taxNumber: orNull(taxNumber),
  };
}

export type DocumentAccessActor =
  | { kind: 'owner'; userId: string }
  | { kind: 'staff'; user: Pick<PublicUser, 'roles' | 'permissions'> }
  | { kind: 'guest'; rawToken: string };

/**
 * The single access gate every future document download MUST use.
 * - owner: the booking's registered customer (server session user id).
 *   Guest-checkout bookings have no owner, so an owner actor never
 *   matches them.
 * - staff: holds `bookings.view` OR `payments.view` (SUPER_ADMIN passes
 *   by the existing hasPermission bypass).
 * - guest: a valid, unexpired, unrevoked booking-access token for THIS
 *   booking's reference. All token failures collapse to `null` so a
 *   probe cannot distinguish malformed from expired.
 * Everything else — including unknown document ids — returns `null`;
 * routes map that to a uniform 404. No public URL exists for documents.
 */
export async function getBookingDocumentForActor(
  actor: DocumentAccessActor,
  documentId: string,
): Promise<BookingDocumentView | null> {
  if (typeof documentId !== 'string' || !documentId) return null;
  const document = await db.bookingDocument.findUnique({
    where: { id: documentId },
    select: { id: true, booking: { select: { reference: true, userId: true } } },
  });
  if (!document) return null;

  switch (actor.kind) {
    case 'owner': {
      if (!actor.userId || document.booking.userId !== actor.userId) return null;
      break;
    }
    case 'staff': {
      if (
        !hasPermission(actor.user, 'bookings.view') &&
        !hasPermission(actor.user, 'payments.view')
      ) {
        return null;
      }
      break;
    }
    case 'guest': {
      let reference: string;
      try {
        ({ reference } = await resolveGuestBookingToken(actor.rawToken));
      } catch (error) {
        if (!(error instanceof GuestBookingAccessError)) throw error;
        return null;
      }
      if (reference !== document.booking.reference) return null;
      break;
    }
    default:
      return null;
  }

  return loadDocumentView(db, document.id);
}

/** base64url of 32 bytes — the same shape as guest booking tokens. */
const VOUCHER_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface VoucherVerifiedService {
  title: string;
  /** Stored travel date (`YYYY-MM-DD`) or '' for open dates. */
  date: string;
}

export interface VoucherVerification {
  valid: boolean;
  /** 'ok' | 'not-recognized' | 'cancelled'. Never exposes why beyond this. */
  reason: 'ok' | 'not-recognized' | 'cancelled';
  voucherNumber: string | null;
  issuedAt: string | null;
  services: VoucherVerifiedService[];
  /** Derived from stored service dates only — display aid, not a promise. */
  serviceStatus: 'upcoming' | 'completed' | 'open-date';
}

function deriveVoucherServiceStatus(dates: string[]): VoucherVerification['serviceStatus'] {
  const dated = dates.filter((date) => date !== '');
  if (dated.length === 0) return 'open-date';
  const today = new Date().toISOString().slice(0, 10);
  return dated.some((date) => date >= today) ? 'upcoming' : 'completed';
}

/**
 * Verifies a voucher QR token for the public verification page.
 *
 * The token authorizes exactly this minimal response: voucher validity
 * plus non-sensitive service identity (titles and stored dates) so an
 * operator can match the presented voucher. Customer identity, contact
 * details, financial amounts, booking references and private booking
 * data are never included. Cancelled bookings verify as invalid — live,
 * at verification time, regardless of when the voucher was issued.
 */
export async function verifyVoucherToken(rawToken: string): Promise<VoucherVerification> {
  const unknown: VoucherVerification = {
    valid: false,
    reason: 'not-recognized',
    voucherNumber: null,
    issuedAt: null,
    services: [],
    serviceStatus: 'open-date',
  };
  if (typeof rawToken !== 'string' || !VOUCHER_TOKEN_PATTERN.test(rawToken)) return unknown;
  const rows = await db.$queryRaw<Array<{ id: string; number: string; bookingId: string; issuedAt: Date }>>`
    SELECT id, number, bookingId, issuedAt FROM booking_documents
    WHERE verificationToken = ${rawToken} AND type = 'BOOKING_VOUCHER'
    LIMIT 1`;
  const document = rows[0];
  if (!document) return unknown;
  const booking = await db.booking.findUnique({
    where: { id: document.bookingId },
    select: {
      status: true,
      items: { select: { tourTitle: true, travelDate: true }, orderBy: { id: 'asc' } },
    },
  });
  if (!booking) return unknown;
  const services = booking.items.map((item) => ({ title: item.tourTitle, date: item.travelDate }));
  const serviceStatus = deriveVoucherServiceStatus(services.map((service) => service.date));
  const issuedAt = document.issuedAt.toISOString();
  if (booking.status === 'CANCELLED') {
    return {
      valid: false,
      reason: 'cancelled',
      voucherNumber: document.number,
      issuedAt,
      services,
      serviceStatus,
    };
  }
  return {
    valid: true,
    reason: 'ok',
    voucherNumber: document.number,
    issuedAt,
    services,
    serviceStatus,
  };
}

/**
 * Documents already issued for one booking, newest first. Read-only:
 * listing never issues, renumbers, or otherwise touches documents, so
 * the admin, customer and guest list endpoints can all share it.
 */
export async function listBookingDocuments(bookingId: string): Promise<BookingDocumentView[]> {
  if (typeof bookingId !== 'string' || !bookingId) return [];
  const rows = await db.bookingDocument.findMany({
    where: { bookingId },
    orderBy: { issuedAt: 'desc' },
    select: DOCUMENT_VIEW_SELECT,
  });
  const extensions = await readDocumentExtensions(db, rows.map((row) => row.id));
  return rows.map((row) => {
    const ext = extensions.get(row.id) ?? null;
    return toDocumentView(row, ext, ext ? refundEventScope(ext.refundAction) : null);
  });
}

/**
 * Public list projection for the admin/owner/guest document lists.
 * Whitelisted fields only: the voucher verification token never leaves
 * the server except inside the authorized voucher PDF itself.
 */
export function toDocumentListItem(view: BookingDocumentView): DocumentListItem {
  return {
    id: view.id,
    number: view.number,
    type: view.type,
    bookingReference: view.bookingReference,
    paymentReference: view.paymentReference,
    amountCents: view.amountCents,
    currency: view.currency,
    issuedAt: view.issuedAt.toISOString(),
  };
}

/**
 * Refund-completion events on one booking, newest first — the option
 * list for the admin refund-note dialog. Each entry anchors to one
 * persisted event; `tracked` tells whether the event carries the
 * per-refund evidence (amount, method, external reference) that a
 * note requires. Historical events predate tracking and are shown as
 * ineligible rather than reinterpreted.
 */
export interface RefundEventOption {
  id: string;
  paymentReference: string;
  scope: 'full' | 'partial';
  amountCents: number | null;
  method: string | null;
  externalReference: string | null;
  createdAt: string;
  tracked: boolean;
}

interface RefundEventRow {
  id: string;
  action: string;
  amountCents: number | null;
  method: string | null;
  externalReference: string | null;
  createdAt: Date;
  paymentReference: string;
}

export async function listBookingRefundEvents(bookingId: string): Promise<RefundEventOption[]> {
  if (typeof bookingId !== 'string' || !bookingId) return [];
  const rows = await db.$queryRaw<RefundEventRow[]>`
    SELECT e.id, e.action, e.amountCents, e.method, e.externalReference,
           e.createdAt, p.reference AS paymentReference
    FROM payment_events AS e
    JOIN payments AS p ON p.id = e.paymentId
    WHERE p.bookingId = ${bookingId}
      AND (e.action = 'Payment refunded' OR e.action = 'Payment partially refunded')
    ORDER BY e.createdAt DESC, e.id DESC`;
  const options: RefundEventOption[] = [];
  for (const row of rows) {
    const scope = refundEventScope(row.action);
    if (!scope) continue;
    options.push({
      id: row.id,
      paymentReference: row.paymentReference,
      scope,
      amountCents: row.amountCents,
      method: row.method,
      externalReference: row.externalReference,
      createdAt: row.createdAt.toISOString(),
      tracked:
        row.amountCents != null &&
        row.amountCents > 0 &&
        !!row.method &&
        !!row.externalReference,
    });
  }
  return options;
}

/**
 * Slim option for the admin receipt dialog: payments on this booking
 * that carry verified money (`amountPaid > 0`), newest first. The list
 * only ADVISES the operator which exact payment to receipt — the
 * issuance service revalidates the chosen reference (same booking,
 * USD, verified money) before anything is created.
 */
export interface VerifiedPaymentOption {
  reference: string;
  amountPaidCents: number;
  paidAt: string | null;
}

export async function listVerifiedBookingPayments(
  bookingId: string,
): Promise<VerifiedPaymentOption[]> {
  if (typeof bookingId !== 'string' || !bookingId) return [];
  const rows = await db.payment.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'desc' },
    select: { reference: true, amountPaid: true, paidAt: true },
  });
  const options: VerifiedPaymentOption[] = [];
  for (const row of rows) {
    const amountPaidCents = decimalToCents(row.amountPaid);
    if (amountPaidCents <= 0) continue;
    options.push({
      reference: row.reference,
      amountPaidCents,
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    });
  }
  return options;
}
