// Payment domain service (Phase 2F-A). Server owns initiation,
// reference issuance, ownership, amounts, status lifecycle, and
// response shaping. The browser supplies a booking reference ONLY —
// never amounts, statuses, provider IDs, references, or ownership.
//
// Phase 2F-A integrates NO gateway: initiation creates a legitimate
// PENDING payment (intent placeholder) awaiting provider handoff in
// Phase 2F-B. No path here marks a payment PAID; `transitionPayment`
// exists solely as the single enforced applier for future provider
// webhooks and audited offline workflows.
import 'server-only';

import { randomInt, randomUUID } from 'node:crypto';
import { Prisma, PaymentStatus as DbStatus } from '@prisma/client';

import { db } from './db';
import { TOUR_BOOKING_CURRENCY } from '@/lib/currency';
import {
  ACTIVE_PAYMENT_STATUSES,
  canTransitionPayment,
  type BookingPaymentSummary,
  type Payment,
  type PaymentActor,
  type PaymentEventView,
  type PaymentStatus,
  type StaffPayment,
} from '@/lib/payment';
import { notifyUser, notifyStaff } from './notifications';
import { sendCustomerEmailSafe, sendStaffEmailSafe } from './email';
import { guestBookingPath, issueGuestBookingToken, revokeGuestBookingTokens } from './booking-access';

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const REF_ATTEMPTS = 5;

function mintReferenceCandidate(): string {
  let suffix = '';
  for (let i = 0; i < 6; i += 1) suffix += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `SP-PAY-${suffix}`;
}

const TO_DB_STATUS: Record<PaymentStatus, DbStatus> = {
  pending: 'PENDING',
  processing: 'PROCESSING',
  paid: 'PAID',
  failed: 'FAILED',
  cancelled: 'CANCELLED',
  refunded: 'REFUNDED',
  partially_refunded: 'PARTIALLY_REFUNDED',
};

const FROM_DB_STATUS: Record<DbStatus, PaymentStatus> = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
};

/** Full booking lifecycle remains independent of payment state. */
export { FROM_DB_STATUS as FROM_DB_PAYMENT_STATUS };

const KEY_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const REF_PATTERN = /^SP-PAY-[A-Z0-9]{6}$/;
export const BOOKING_REF_PATTERN = /^(SP-BK-[A-Z0-9]{6}|SP-[A-Z0-9]{10})$/;

/** Integer-cents helpers: persisted money is computed in cents and
 *  stored as DECIMAL — never float arithmetic. */
function decimalToCents(value: Prisma.Decimal | number | string): number {
  return Math.round(Number(value.toString()) * 100);
}

function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

function dollars(cents: number): number {
  return Math.round(cents) / 100;
}

type PaymentRow = Prisma.PaymentGetPayload<{
  include: {
    events: true;
    booking: {
      select: {
        reference: true;
        userId: true;
        total: true;
        currency: true;
        status: true;
        contactName: true;
        contactEmail: true;
        contactPhone: true;
        user: { select: { email: true; firstName: true; lastName: true } };
      };
    };
  };
}>;

function accountName(row: PaymentRow): string {
  const user = row.booking.user;
  if (!user) return '';
  const full = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return full || user.email;
}

function toEventViews(
  events: PaymentRow['events'],
  includeInternal: boolean,
): PaymentEventView[] {
  return [...events]
    .filter((e) => includeInternal || !e.isInternal)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((e) => ({
      at: e.createdAt.toISOString(),
      by: (e.actorRole === 'staff' || e.actorRole === 'system' || e.actorRole === 'provider'
        ? e.actorRole
        : 'customer') as PaymentActor,
      action: e.action,
      ...(e.note ? { note: e.note } : {}),
      ...(includeInternal && e.isInternal ? { internal: true as const } : {}),
    }));
}

/**
 * Customer-safe projection: no database IDs, no user linkage, no
 * internal events, no provider secrets. `metadata` is never exposed.
 */
export function toCustomerPaymentView(row: PaymentRow): Payment {
  return {
    reference: row.reference,
    bookingReference: row.booking.reference,
    provider: row.provider,
    providerPaymentId: row.providerPaymentId,
    status: FROM_DB_STATUS[row.status],
    amount: dollars(decimalToCents(row.amount)),
    amountPaid: dollars(decimalToCents(row.amountPaid)),
    amountRefunded: dollars(decimalToCents(row.amountRefunded)),
    currency: row.currency,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    initiatedAt: row.initiatedAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    refundedAt: row.refundedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    events: toEventViews(row.events, false),
  };
}

/** Staff projection: everything customer-safe plus the linked account. */
export function toStaffPaymentView(row: PaymentRow): StaffPayment {
  const base = toCustomerPaymentView(row);
  return {
    ...base,
    events: toEventViews(row.events, true),
    account: row.booking.user
      ? { email: row.booking.user.email, name: accountName(row) }
      : null,
  };
}

/**
 * Derived booking payment summary from real Payment rows. Bookings
 * with no payment record are `unpaid` — nothing is fabricated.
 * `bookingTotalCents` is the server-side booking total.
 */
export function deriveBookingPaymentSummary(
  payments: { status: PaymentStatus; amountPaidCents: number; amountRefundedCents: number; reference: string; createdAt: Date; currency?: string }[],
  bookingTotalCents: number,
  bookingCurrency: string = TOUR_BOOKING_CURRENCY,
): BookingPaymentSummary {
  // Optional currency keeps existing pure-helper callers compatible. Persisted
  // callers always supply it; an explicit mismatch must never be summed.
  if (payments.some((p) => p.currency !== undefined && p.currency !== bookingCurrency)) {
    throw new Error('Payment currency does not match booking currency. Financial review is required.');
  }
  const ordered = [...payments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const paidTotal = payments
    .filter((p) => p.status === 'paid' || p.status === 'partially_refunded' || p.status === 'refunded')
    .reduce((sum, p) => sum + p.amountPaidCents, 0);
  const refundedTotal = payments.reduce((sum, p) => sum + p.amountRefundedCents, 0);
  const latest = ordered[0];
  if (!latest) {
    return { state: 'unpaid', payments: 0, paidTotal: 0, refundedTotal: 0, latestReference: null };
  }
  let state: BookingPaymentSummary['state'] = 'pending';
  if (paidTotal >= bookingTotalCents && bookingTotalCents > 0) {
    state = refundedTotal >= paidTotal && paidTotal > 0 ? 'refunded' : refundedTotal > 0 ? 'partially_refunded' : 'paid';
  } else if (latest.status === 'processing') {
    state = 'processing';
  } else if (latest.status === 'failed') {
    state = 'failed';
  } else if (latest.status === 'cancelled' && !ordered.some((p) => p.status === 'pending' || p.status === 'processing')) {
    state = 'pending';
  }
  return {
    state,
    payments: payments.length,
    paidTotal: dollars(paidTotal),
    refundedTotal: dollars(refundedTotal),
    latestReference: latest.reference,
  };
}

const paymentInclude = {
  events: true,
  booking: {
    select: {
      reference: true,
      userId: true,
      total: true,
      currency: true,
      status: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      user: { select: { email: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.PaymentInclude;

const INITIATE_KEYS = new Set(['bookingReference', 'idempotencyKey']);

export interface ValidatedPaymentInitiation {
  bookingReference: string;
  idempotencyKey: string;
}

/**
 * Strict server validation of the initiation body. Only the booking
 * reference and an optional client idempotency key are accepted —
 * amounts, statuses, providers, and ownership are never read.
 */
export function validatePaymentInitiation(input: unknown): ValidatedPaymentInitiation {
  if (typeof input !== 'object' || input === null) throw new Error('Invalid request.');
  const body = input as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!INITIATE_KEYS.has(key)) throw new Error('Invalid request.');
  }
  const bookingReference = typeof body.bookingReference === 'string' ? body.bookingReference.trim() : '';
  if (!BOOKING_REF_PATTERN.test(bookingReference)) throw new Error('Select a valid booking.');
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  if (idempotencyKey !== '' && !KEY_PATTERN.test(idempotencyKey)) throw new Error('Invalid request.');
  return { bookingReference, idempotencyKey };
}

/**
 * Initiate exactly one active payment attempt for an eligible booking
 * owned by the customer. A repeated initiation while an active
 * (pending/processing) attempt exists returns the original payment
 * instead of creating a duplicate. The record is always PENDING —
 * initiation never marks money as paid.
 */
export async function initiateCustomerPayment(
  userId: string,
  input: ValidatedPaymentInitiation,
): Promise<{ payment: Payment; created: boolean }> {
  const booking = await db.booking.findUnique({
    where: { reference: input.bookingReference },
    select: { id: true, userId: true, status: true, total: true, currency: true },
  });
  // Guest bookings (userId NULL) never match an authenticated customer.
  if (!booking || !booking.userId || booking.userId !== userId) {
    throw new Error('Booking not found.');
  }
  if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
    throw new Error('This booking is no longer payable.');
  }
  if (booking.currency !== TOUR_BOOKING_CURRENCY) {
    throw new Error('Only USD bookings can take new payments. Financial review is required.');
  }
  const totalCents = decimalToCents(booking.total);
  if (totalCents <= 0) throw new Error('This booking has no amount due.');

  const assertReplayOwnership = (row: PaymentRow) => {
    if (row.bookingId !== booking.id || row.booking.userId !== userId || row.booking.reference !== input.bookingReference) {
      throw new Error('That submission key was already used for a different payment.');
    }
    if (row.currency !== booking.currency || row.booking.currency !== booking.currency) {
      throw new Error('Payment currency does not match booking currency. Financial review is required.');
    }
  };

  let lastError: unknown = null;
  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt += 1) {
    const reference = mintReferenceCandidate();
    try {
      const result = await db.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string; userId: string | null; status: string; total: Prisma.Decimal; currency: string }>>`
          SELECT id, userId, status, total, currency FROM bookings
          WHERE id = ${booking.id} FOR UPDATE`;
        const current = locked[0];
        if (!current || current.userId !== userId) throw new Error('Booking not found.');
        if (current.currency !== TOUR_BOOKING_CURRENCY) {
          throw new Error('Only USD bookings can take new payments. Financial review is required.');
        }
        if (current.status !== 'PENDING' && current.status !== 'CONFIRMED') {
          throw new Error('This booking is no longer payable.');
        }
        if (decimalToCents(current.total) <= 0) throw new Error('This booking has no amount due.');
        // These checks share the booking lock with creation, so concurrent
        // requests with different keys still create only one active attempt.
        if (input.idempotencyKey !== '') {
          const replay = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: paymentInclude });
          if (replay) {
            assertReplayOwnership(replay);
            return { row: replay, created: false };
          }
        }
        const active = await tx.payment.findFirst({
          where: { bookingId: current.id, status: { in: ['PENDING', 'PROCESSING'] } },
          orderBy: { createdAt: 'desc' }, include: paymentInclude,
        });
        if (active) {
          assertReplayOwnership(active);
          return { row: active, created: false };
        }
        const row = await tx.payment.create({
          data: {
            reference,
            bookingId: booking.id,
            provider: 'pending',
            status: 'PENDING',
            currency: 'USD',
            amount: centsToDecimal(decimalToCents(current.total)),
            amountPaid: centsToDecimal(0),
            amountRefunded: centsToDecimal(0),
            idempotencyKey: input.idempotencyKey === '' ? null : input.idempotencyKey,
            events: {
              create: { actorRole: 'customer', action: 'Payment initiated' },
            },
          },
          include: paymentInclude,
        });
        return { row, created: true };
      });
      const { row } = result;
      if (!result.created) return { payment: toCustomerPaymentView(row), created: false };
      // Initiation receipt only, on first creation. Idempotent replays
      // and active-attempt dedup return early with created:false, so a
      // retried initiation never notifies twice. Copy stays truthful:
      // nothing has been charged — no provider is connected yet.
      await notifyUser(userId, {
        type: 'payment_initiated',
        title: 'Payment initiated',
        message: `Payment ${reference} for booking ${input.bookingReference} was initiated. No charge is made online.`,
        href: `/account/payments/detail?ref=${encodeURIComponent(reference)}`,
      });
      // Staff copy on first creation only (truthful: initiated/pending,
      // never paid). Runs only on the created path so retries never
      // double-notify.
      await notifyStaff({
        type: 'admin_payment_initiated',
        title: 'Payment initiated',
        message: `Payment ${reference} for booking ${input.bookingReference} is pending. No charge completed.`,
        href: `/admin/payments/${encodeURIComponent(reference)}`,
      });
      // Email receipts (best-effort — never break initiation).
      // Customer copy to the payer's account email; staff copy to
      // the configured operational recipient.
      try {
        const payer = await db.user.findUnique({
          where: { id: userId },
          select: { email: true, firstName: true, lastName: true },
        });
        const payerName = payer ? `${payer.firstName ?? ''} ${payer.lastName ?? ''}`.trim() || payer.email : null;
        if (payer && payerName) {
          await sendCustomerEmailSafe('payment_initiated', payer.email, {
            name: payerName,
            reference,
            bookingReference: input.bookingReference,
            detailUrl: `/account/payments/detail?ref=${encodeURIComponent(reference)}`,
          }, { relatedReference: reference, idempotencyKey: `payment_initiated:${reference}` });
        }
      } catch {
        /* email never breaks initiation */
      }
      await sendStaffEmailSafe('admin_payment_initiated', {
        reference,
        bookingReference: input.bookingReference,
        detailUrl: `/admin/payments/${encodeURIComponent(reference)}`,
      }, { relatedReference: reference, idempotencyKey: `admin_payment_initiated:${reference}` });
      return { payment: toCustomerPaymentView(row), created: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Idempotency-key race: another request won — return the winner.
        const target = (error.meta?.target as string[] | undefined) ?? [];
        if (target.includes('idempotencyKey') && input.idempotencyKey !== '') {
          const winner = await db.payment.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
            include: paymentInclude,
          });
          if (winner) {
            assertReplayOwnership(winner);
            return { payment: toCustomerPaymentView(winner), created: false };
          }
        }
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not initiate the payment. Please try again.');
}

/**
 * Offline receipt methods a staff member may record. Closed allowlist:
 * anything else is rejected — never stored, never converted.
 */
export const OFFLINE_PAYMENT_METHODS = ['bank_transfer', 'cash'] as const;
export type OfflinePaymentMethod = (typeof OFFLINE_PAYMENT_METHODS)[number];

const OFFLINE_METHOD_LABELS: Record<OfflinePaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
};

export interface RecordOfflinePaymentInput {
  bookingReference: string;
  /** Received amount in dollars (at most 2 decimals, above zero). */
  amount: number;
  /** Must be 'USD'. Foreign currency is rejected, never converted. */
  currency: string;
  method: string;
  /** Bank/reference number (optional, 255 chars or fewer). */
  referenceNote?: string;
  /** Required idempotency key: repeats return the original receipt. */
  idempotencyKey: string;
}

type LockedOfflineBookingRow = {
  id: string;
  status: string;
  currency: string;
  total: Prisma.Decimal | number | string;
};

function hasControlChars(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u001f\u007f]/.test(value);
}

async function paymentDetailUrlForCustomer(booking: { reference: string; userId: string | null }, paymentReference: string) {
  if (booking.userId !== null) {
    return `/account/payments/detail?ref=${encodeURIComponent(paymentReference)}`;
  }
  try {
    await revokeGuestBookingTokens(booking.reference);
    const access = await issueGuestBookingToken(booking.reference);
    if (access) return guestBookingPath(access.token);
  } catch {
    /* A link failure must not undo money already recorded. */
  }
  return '/contact';
}

/**
 * Records an offline receipt (cash/bank transfer) as PAID by explicit,
 * authorized staff confirmation — no gateway involved. Each receipt is
 * its own Payment row (`provider: 'offline'`), so partial payments
 * accumulate honestly in the booking summary and a partial receipt
 * never fakes a full payment. Returns null for an unknown booking
 * (route maps to 404); validation and state problems throw.
 */
export async function recordOfflinePayment(
  input: RecordOfflinePaymentInput,
): Promise<{ payment: StaffPayment; created: boolean } | null> {
  const bookingReference =
    typeof input.bookingReference === 'string' ? input.bookingReference.trim() : '';
  if (!BOOKING_REF_PATTERN.test(bookingReference)) throw new Error('Select a valid booking.');
  if (input.method !== 'bank_transfer' && input.method !== 'cash') {
    throw new Error('Select a valid payment method.');
  }
  const method = input.method as OfflinePaymentMethod;
  if (input.currency !== 'USD') {
    throw new Error(
      'Offline receipts are recorded in USD only. Convert the received amount before recording.',
    );
  }
  if (typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Enter a valid received amount.');
  }
  if (Math.abs(input.amount * 100 - Math.round(input.amount * 100)) > 1e-6) {
    throw new Error('Enter an amount with at most 2 decimals.');
  }
  const amountCents = Math.round(input.amount * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('Invalid payment amounts.');
  const referenceNote =
    typeof input.referenceNote === 'string' ? input.referenceNote.trim() : '';
  if (referenceNote.length > 255 || hasControlChars(referenceNote)) {
    throw new Error('Enter a valid reference note (255 characters or fewer).');
  }
  const idempotencyKey =
    typeof input.idempotencyKey === 'string' ? input.idempotencyKey.trim() : '';
  if (!KEY_PATTERN.test(idempotencyKey)) throw new Error('Invalid request.');

  const replayMatches = (row: PaymentRow) =>
    row.booking.reference === bookingReference &&
    row.currency === TOUR_BOOKING_CURRENCY &&
    row.booking.currency === TOUR_BOOKING_CURRENCY &&
    row.provider === 'offline' &&
    row.events.some((event) => event.action === 'Offline payment recorded' && event.note === `Offline ${OFFLINE_METHOD_LABELS[method]} receipt${referenceNote ? `: ${referenceNote}` : ''}`) &&
    decimalToCents(row.amountPaid) === amountCents;

  let result: { row: PaymentRow; created: boolean } | null = null;
  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt += 1) {
    const reference = mintReferenceCandidate();
    try {
      result = await db.$transaction(async (tx) => {
        // Booking lock serializes every manual receipt for this booking.
        // The balance check and the PAID row now commit atomically, so
        // two different idempotency keys cannot overpay the same balance.
        const locked = await tx.$queryRaw<LockedOfflineBookingRow[]>`
          SELECT id, status, total, currency FROM bookings
          WHERE reference = ${bookingReference} FOR UPDATE`;
        const booking = locked[0];
        if (!booking) return null;
        if (booking.currency !== TOUR_BOOKING_CURRENCY) {
          throw new Error('Only USD bookings can take new payments. Financial review is required.');
        }
        if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
          throw new Error('Only pending or confirmed bookings can take payment.');
        }

        const replay = await tx.payment.findUnique({
          where: { idempotencyKey },
          include: paymentInclude,
        });
        if (replay) {
          if (!replayMatches(replay)) {
            throw new Error('That submission key was already used for a different payment.');
          }
          return { row: replay, created: false };
        }

        const settled = await tx.payment.findMany({
          where: { bookingId: booking.id },
          select: { status: true, amountPaid: true, amountRefunded: true, currency: true },
        });
        if (settled.some((payment) => payment.currency !== booking.currency)) {
          throw new Error('Payment currency does not match booking currency. Financial review is required.');
        }
        const isSettled = (status: string) =>
          status === 'PAID' || status === 'PARTIALLY_REFUNDED' || status === 'REFUNDED';
        const paidCents = settled
          .filter((payment) => isSettled(payment.status))
          .reduce((sum, payment) => sum + decimalToCents(payment.amountPaid), 0);
        const refundedCents = settled.reduce(
          (sum, payment) => sum + decimalToCents(payment.amountRefunded),
          0,
        );
        const remainingCents = decimalToCents(booking.total) - (paidCents - refundedCents);
        if (remainingCents <= 0) throw new Error('This booking is already paid in full.');
        if (amountCents > remainingCents) {
          throw new Error('The received amount exceeds the remaining balance.');
        }

        const recordedNote =
          `Offline ${OFFLINE_METHOD_LABELS[method]} receipt` +
          (referenceNote ? `: ${referenceNote}` : '');
        const receiptNote = `${recordedNote} — recorded by staff`;
        const row = await tx.payment.create({
          data: {
            reference,
            bookingId: booking.id,
            provider: 'offline',
            status: 'PAID',
            currency: 'USD',
            amount: centsToDecimal(decimalToCents(booking.total)),
            amountPaid: centsToDecimal(amountCents),
            amountRefunded: centsToDecimal(0),
            paidAt: new Date(),
            idempotencyKey,
            events: {
              create: [
                {
                  actorRole: 'staff',
                  action: 'Offline payment recorded',
                  note: recordedNote,
                  isInternal: true,
                },
                {
                  actorRole: 'staff',
                  action: 'Payment completed',
                  note: receiptNote,
                  isInternal: false,
                },
              ],
            },
          },
          include: paymentInclude,
        });
        return { row, created: true };
      });
      if (!result) return null;
      break;
    } catch (error) {
      // Duck-typed P2002 (same convention as booking idempotency):
      // a key race means another request won — return the winner.
      const code =
        typeof error === 'object' && error !== null
          ? (error as { code?: unknown }).code
          : undefined;
      if (code === 'P2002') {
        const winner = await db.payment.findUnique({
          where: { idempotencyKey },
          include: paymentInclude,
        });
        if (winner) {
          if (!replayMatches(winner)) {
            throw new Error('That submission key was already used for a different payment.');
          }
          return { payment: toStaffPaymentView(winner), created: false };
        }
        continue;
      }
      throw error;
    }
  }
  if (!result) {
    throw new Error('Could not record the payment. Please try again.');
  }
  const paid = toStaffPaymentView(result.row);
  if (!result.created) return { payment: paid, created: false };

  try {
    const detailUrl = await paymentDetailUrlForCustomer(result.row.booking, result.row.reference);
    await sendCustomerEmailSafe('payment_paid', result.row.booking.contactEmail, {
      name: result.row.booking.contactName,
      reference: result.row.reference,
      bookingReference: result.row.booking.reference,
      detailUrl,
    }, { relatedReference: result.row.reference, idempotencyKey: `payment_paid:${result.row.reference}` });
  } catch {
    /* email never breaks an already-recorded receipt */
  }

  await notifyStaff({
    type: 'admin_payment_recorded',
    title: 'Offline payment recorded',
    message: `Offline ${OFFLINE_METHOD_LABELS[method]} receipt ${paid.reference} for booking ${bookingReference} was marked paid.`,
    href: `/admin/payments/${encodeURIComponent(paid.reference)}`,
  });
  return { payment: paid, created: true };
}

export interface RecordOfflineRefundInput {
  paymentReference: string;
  /** Refund amount in dollars (at most 2 decimals, above zero). */
  amount: number;
  method: string;
  /** External bank/reference number (required, 255 chars or fewer). */
  externalReference?: string;
  /** Reason or internal note (optional, 1000 chars or fewer). */
  note?: string;
  /** Explicit staff confirmation that the money was actually returned. */
  confirmReturned?: unknown;
}

/**
 * Records an ACTUALLY COMPLETED offline refund against captured money.
 * No transfer is initiated here — the money must already have been
 * returned outside the website; this only records the fact, audited,
 * by explicit staff confirmation. Partial refunds accumulate: each
 * call adds to `amountRefunded`, and only a zero net balance makes a
 * booking cancellable under the existing guard. Never fabricates.
 */
export async function recordOfflineRefund(
  input: RecordOfflineRefundInput,
): Promise<{ payment: StaffPayment; created: boolean }> {
  const paymentReference =
    typeof input.paymentReference === 'string' ? input.paymentReference.trim() : '';
  if (!REF_PATTERN.test(paymentReference)) throw new Error('Select a valid payment.');
  if (input.method !== 'bank_transfer' && input.method !== 'cash') {
    throw new Error('Select a valid refund method.');
  }
  const method = input.method as OfflinePaymentMethod;
  if (typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Enter a valid refund amount.');
  }
  if (Math.abs(input.amount * 100 - Math.round(input.amount * 100)) > 1e-6) {
    throw new Error('Enter an amount with at most 2 decimals.');
  }
  const amountCents = Math.round(input.amount * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('Invalid payment amounts.');
  const externalReference =
    typeof input.externalReference === 'string' ? input.externalReference.trim() : '';
  if (
    externalReference === '' ||
    externalReference.length > 255 ||
    hasControlChars(externalReference)
  ) {
    throw new Error('Enter the external bank/reference number (255 characters or fewer).');
  }
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > 1000 || hasControlChars(note)) {
    throw new Error('Enter a valid reason (1000 characters or fewer).');
  }
  if (input.confirmReturned !== true) {
    throw new Error('Confirm that the money has actually been returned.');
  }

  const existing = await db.payment.findUnique({
    where: { reference: paymentReference },
    include: paymentInclude,
  });
  if (!existing) throw new Error('Payment not found.');

  if (existing.currency !== TOUR_BOOKING_CURRENCY || existing.booking.currency !== TOUR_BOOKING_CURRENCY) {
    throw new Error('Offline refunds require a USD payment and booking. Financial review is required.');
  }

  // Natural idempotency key, checked BEFORE balance math so a repeat
  // submission of a settled refund returns instead of tripping the
  // zero-balance guard: the same payment + amount + external reference
  // is the same real-world refund. Two genuinely distinct refunds
  // always differ in amount or reference.
  const receiptNote =
    `Offline ${OFFLINE_METHOD_LABELS[method]} refund ${externalReference}` +
    (note ? ` — ${note}` : '') +
    ' — return confirmed by staff';
  const duplicate = existing.events.some(
    (event) =>
      (event.action === 'Payment refunded' || event.action === 'Payment partially refunded') &&
      ((event.amountCents === amountCents && event.method === method && event.externalReference === externalReference) ||
        (event.amountCents == null && event.method == null && event.externalReference == null && event.note === receiptNote)),
  );
  if (duplicate) {
    return { payment: toStaffPaymentView(existing), created: false };
  }

  const paidCents = decimalToCents(existing.amountPaid);
  const refundedCents = decimalToCents(existing.amountRefunded);
  const refundableCents = paidCents - refundedCents;
  if (refundableCents <= 0) {
    throw new Error('This payment has no captured money left to refund.');
  }
  if (amountCents > refundableCents) {
    throw new Error('The refund amount exceeds the remaining refundable balance.');
  }

  const target: PaymentStatus =
    refundedCents + amountCents >= paidCents ? 'refunded' : 'partially_refunded';
  let updated: StaffPayment | null;
  try {
    updated = await transitionPayment(paymentReference, target, {
      actor: 'staff',
      note: receiptNote,
      internal: true,
      // Recomputed from the locked payment row inside transitionPayment,
      // so repeated partial refunds accumulate without lost updates.
      refundDeltaCents: amountCents,
      dedupeEventNote: receiptNote,
      // Phase D: this event alone identifies the refund (amount, method,
      // external reference), so a commercial refund note can anchor to it.
      eventAmountCents: amountCents,
      eventMethod: method,
      eventExternalReference: externalReference,
    });
  } catch (error) {
    if (error instanceof DuplicateOfflineRefund) {
      const replay = await db.payment.findUnique({
        where: { reference: paymentReference },
        include: paymentInclude,
      });
      if (replay) return { payment: toStaffPaymentView(replay), created: false };
    }
    throw error;
  }
  if (!updated) throw new Error('Could not record the refund. Please try again.');

  await notifyStaff({
    type: 'admin_payment_refunded',
    title: 'Offline refund recorded',
    message: `Offline ${OFFLINE_METHOD_LABELS[method]} refund ${updated.reference} was recorded.`,
    href: `/admin/payments/${encodeURIComponent(updated.reference)}`,
  });
  return { payment: updated, created: true };
}

export async function listCustomerPayments(userId: string): Promise<Payment[]> {
  const rows = await db.payment.findMany({
    where: { booking: { userId } },
    orderBy: { createdAt: 'desc' },
    include: paymentInclude,
  });
  return rows.map(toCustomerPaymentView);
}

export async function getCustomerPayment(
  userId: string,
  reference: string,
): Promise<Payment | null> {
  if (!REF_PATTERN.test(reference)) return null;
  const row = await db.payment.findUnique({
    where: { reference },
    include: paymentInclude,
  });
  // Guest bookings (userId NULL) never match an authenticated customer.
  if (!row || !row.booking.userId || row.booking.userId !== userId) return null;
  return toCustomerPaymentView(row);
}

export interface StaffPaymentFilters {
  status?: PaymentStatus;
  query?: string;
  from?: Date;
  to?: Date;
}

export async function listStaffPayments(filters: StaffPaymentFilters = {}): Promise<StaffPayment[]> {
  const where: Prisma.PaymentWhereInput = {};
  if (filters.status) where.status = TO_DB_STATUS[filters.status];
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  const q = filters.query?.trim();
  if (q) {
    where.OR = [
      { reference: { contains: q } },
      { providerPaymentId: { contains: q } },
      { booking: { reference: { contains: q } } },
      { booking: { contactEmail: { contains: q } } },
      { booking: { contactName: { contains: q } } },
    ];
  }
  const rows = await db.payment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: paymentInclude,
  });
  return rows.map(toStaffPaymentView);
}

export async function getStaffPayment(reference: string): Promise<StaffPayment | null> {
  if (!REF_PATTERN.test(reference)) return null;
  const row = await db.payment.findUnique({
    where: { reference },
    include: paymentInclude,
  });
  if (!row) return null;
  return toStaffPaymentView(row);
}

export type PaymentMoneySnapshot = {
  reference: string;
  status: PaymentStatus;
  amountCents: number;
  amountPaidCents: number;
  amountRefundedCents: number;
  currency: string;
};

/**
 * Resolves the internal payment record for a verified provider
 * identifier. Provider webhooks reference OUR record by THEIR id
 * (`providerPaymentId`, unique) — never by our `reference` — so the
 * handler must resolve through this lookup before transitioning.
 * Returns null when no record carries the identifier (unknown payment).
 */
export async function findPaymentByProviderId(
  providerPaymentId: string,
): Promise<PaymentMoneySnapshot | null> {
  if (typeof providerPaymentId !== 'string') return null;
  const trimmed = providerPaymentId.trim();
  if (!trimmed || trimmed.length > 128) return null;
  const row = await db.payment.findUnique({
    where: { providerPaymentId: trimmed },
    select: {
      reference: true,
      status: true,
      amount: true,
      amountPaid: true,
      amountRefunded: true,
      currency: true,
    },
  });
  if (!row) return null;
  return {
    reference: row.reference,
    status: FROM_DB_STATUS[row.status],
    amountCents: decimalToCents(row.amount),
    amountPaidCents: decimalToCents(row.amountPaid),
    amountRefundedCents: decimalToCents(row.amountRefunded),
    currency: row.currency,
  };
}

/**
 * Thrown when a webhook redelivery collides on the persisted provider
 * event identity: the money already moved, so the caller must
 * acknowledge idempotently instead of transitioning again.
 */
export class DuplicateWebhookEvent extends Error {
  readonly code = 'DUPLICATE_WEBHOOK_EVENT';
  constructor(readonly providerEventId: string) {
    super('Duplicate provider event: already applied.');
    this.name = 'DuplicateWebhookEvent';
  }
}

/**
 * Thrown when a verified paid event targets a booking that is already
 * cancelled. Settling would create paid-on-cancelled money, so the
 * transition is refused and the caller must preserve the evidence
 * (event id, references, amounts) for manual reconciliation.
 */
export class PaidOnCancelledBooking extends Error {
  readonly code = 'PAID_ON_CANCELLED_BOOKING';
  constructor(readonly paymentReference: string) {
    super('Payment booking is already cancelled: paid settlement refused.');
    this.name = 'PaidOnCancelledBooking';
  }
}

/** Locking row read: current committed state, never a stale snapshot. */
type LockedPaymentRow = {
  id: string;
  status: string;
  bookingId: string;
  currency: string;
  amountPaid: Prisma.Decimal | number | string;
  amountRefunded: Prisma.Decimal | number | string;
};

class DuplicateOfflineRefund extends Error {
  constructor() {
    super('Offline refund already recorded.');
    this.name = 'DuplicateOfflineRefund';
  }
}

/**
 * Single enforced applier for server-side payment transitions
 * (Phase 2F-B provider webhooks, audited offline workflows). NOT
 * reachable from any Phase 2F-A route: no browser input can change
 * payment status. Amounts are validated in integer cents.
 *
 * Concurrency contract (race safety):
 * - the payment row is locked and re-read INSIDE the transaction;
 *   the status predicate on the write is evaluated on locked state,
 *   so concurrent transitions serialize instead of overwriting;
 * - a `providerEventId` (webhooks) is claimed atomically with the
 *   transition via its unique index: a redelivery collides (P2002)
 *   and surfaces as DuplicateWebhookEvent — the claim row and the
 *   money move commit together, never separately;
 * - settling PAID on a cancelled booking is refused outright.
 */
async function transitionPayment(
  reference: string,
  to: PaymentStatus,
  options: {
    actor: PaymentActor;
    note?: string;
    internal?: boolean;
    amountPaidCents?: number;
    amountRefundedCents?: number;
    providerPaymentId?: string;
    failureCode?: string;
    failureMessage?: string;
    providerEventId?: string;
    /**
     * Phase D per-event evidence. Written only by completed offline
     * refunds (the amount, method and external reference of THIS
     * event); every other transition leaves these NULL. Historical
     * refund events therefore carry no per-event data and stay
     * ineligible for refund notes.
     */
    eventAmountCents?: number;
    eventMethod?: string;
    eventExternalReference?: string;
    /** Increment applied from the locked row, used by offline refunds. */
    refundDeltaCents?: number;
    /** Natural idempotency anchor for a completed offline refund. */
    dedupeEventNote?: string;
  },
): Promise<StaffPayment | null> {
  const existing = await db.payment.findUnique({ where: { reference } });
  if (!existing) return null;
  const preview = FROM_DB_STATUS[existing.status];
  if (options.refundDeltaCents === undefined && !canTransitionPayment(preview, to)) {
    throw new Error('This payment change is not allowed.');
  }
  const now = new Date();
  let appliedTo = to;
  let row;
  try {
    row = await db.$transaction(async (tx) => {
      // Lock the payment row and re-validate on locked (current)
      // state: a concurrent transition that committed after the
      // pre-read above cannot slip through.
      // Keep the same booking -> payment lock order as cancellation/receipts.
      const lockedBooking = await tx.$queryRaw<{ id: string; status: string; currency: string }[]>`
        SELECT id, status, currency FROM bookings WHERE id = ${existing.bookingId} FOR UPDATE`;
      const booking = lockedBooking[0];
      if (!booking) throw new Error('Booking not found.');
      const locked = await tx.$queryRaw<LockedPaymentRow[]>`
        SELECT id, status, bookingId, currency, amountPaid, amountRefunded
        FROM payments WHERE reference = ${reference} FOR UPDATE`;
      const currentRow = locked[0];
      if (!currentRow) {
        throw new Error('Payment not found.');
      }
      if (currentRow.bookingId !== booking.id || currentRow.currency !== booking.currency ||
        (options.refundDeltaCents !== undefined && booking.currency !== TOUR_BOOKING_CURRENCY)) {
        throw new Error('Payment currency does not match booking currency. Financial review is required.');
      }
      if (options.dedupeEventNote) {
        const duplicate = await tx.paymentEvent.findFirst({
          where: {
            paymentId: currentRow.id,
            action: { in: ['Payment refunded', 'Payment partially refunded'] },
            OR: [
              { amountCents: options.eventAmountCents, method: options.eventMethod, externalReference: options.eventExternalReference },
              { amountCents: null, method: null, externalReference: null, note: options.dedupeEventNote },
            ],
          },
          select: { id: true },
        });
        if (duplicate) throw new DuplicateOfflineRefund();
      }
      const current = FROM_DB_STATUS[currentRow.status as DbStatus];
      const lockedPaidCents = decimalToCents(currentRow.amountPaid);
      const lockedRefundedCents = decimalToCents(currentRow.amountRefunded);
      if (options.refundDeltaCents !== undefined) {
        if (!Number.isSafeInteger(options.refundDeltaCents) || options.refundDeltaCents <= 0) {
          throw new Error('Invalid payment amounts.');
        }
        const refundableCents = lockedPaidCents - lockedRefundedCents;
        if (refundableCents <= 0) {
          throw new Error('This payment has no captured money left to refund.');
        }
        if (options.refundDeltaCents > refundableCents) {
          throw new Error('The refund amount exceeds the remaining refundable balance.');
        }
        appliedTo = options.refundDeltaCents === refundableCents ? 'refunded' : 'partially_refunded';
      } else {
        appliedTo = to;
      }
      if (!canTransitionPayment(current, appliedTo)) {
        throw new Error('This payment change is not allowed.');
      }
      if (appliedTo === 'paid' && booking.status === 'CANCELLED') {
        throw new PaidOnCancelledBooking(reference);
      }
      const amountPaidCents = options.amountPaidCents ?? lockedPaidCents;
      const amountRefundedCents = options.refundDeltaCents !== undefined
        ? lockedRefundedCents + options.refundDeltaCents
        : options.amountRefundedCents ?? lockedRefundedCents;
      if (amountPaidCents < 0 || amountRefundedCents < 0 || amountRefundedCents > amountPaidCents) {
        throw new Error('Invalid payment amounts.');
      }
      // Conditional write on the locked status: even if locking were
      // ever bypassed, a concurrently moved row matches zero rows
      // instead of being overwritten. The audit event is a separate
      // create in the same transaction so the money move and its
      // evidence commit atomically — including the unique
      // providerEventId claim that absorbs redeliveries.
      const claimed = await tx.payment.updateMany({
        where: { id: currentRow.id, status: currentRow.status as DbStatus },
        data: {
          status: TO_DB_STATUS[appliedTo],
          amountPaid: centsToDecimal(amountPaidCents),
          amountRefunded: centsToDecimal(amountRefundedCents),
          ...(options.providerPaymentId ? { providerPaymentId: options.providerPaymentId } : {}),
          ...(options.failureCode ? { failureCode: options.failureCode.slice(0, 64) } : {}),
          ...(options.failureMessage ? { failureMessage: options.failureMessage.slice(0, 255) } : {}),
          ...(appliedTo === 'paid' ? { paidAt: now } : {}),
          ...(appliedTo === 'failed' ? { failedAt: now } : {}),
          ...(appliedTo === 'cancelled' ? { cancelledAt: now } : {}),
          ...(appliedTo === 'refunded' || appliedTo === 'partially_refunded' ? { refundedAt: now } : {}),
        },
      });
      if (claimed.count === 0) {
        throw new Error('Payment changed concurrently; retry the webhook.');
      }
      // The audit event doubles as the idempotency claim: the unique
      // providerEventId commits atomically with the money move, so a
      // redelivered event collides (P2002 → DuplicateWebhookEvent)
      // instead of double-applying. Parameterized raw SQL is
      // deliberate — fully bound values, no string interpolation.
      await tx.$executeRaw`
        INSERT INTO payment_events
          (id, paymentId, actorRole, action, note, isInternal, providerEventId, amountCents, method, externalReference)
        VALUES (
          ${randomUUID()},
          ${currentRow.id},
          ${options.actor},
          ${paymentTransitionAction(current, appliedTo)},
          ${options.note?.slice(0, 1000) || null},
          ${options.internal ?? true},
          ${options.providerEventId ?? null},
          ${options.eventAmountCents ?? null},
          ${options.eventMethod?.slice(0, 32) ?? null},
          ${options.eventExternalReference?.slice(0, 255) ?? null}
        )`;
      return tx.payment.findUnique({ where: { id: currentRow.id }, include: paymentInclude });
    });
  } catch (error) {
    // P2002 inside this transaction can only come from the unique
    // providerEventId claim (the payment row itself is locked): the
    // event already applied, so surface an idempotent duplicate.
    if (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === 'P2002' &&
      options.providerEventId
    ) {
      throw new DuplicateWebhookEvent(options.providerEventId);
    }
    throw error;
  }
  if (!row) return null;
  // Customer email on meaningful money outcomes only (paid / failed /
  // refunded / partially refunded). Processing/cancelled/pending are
  // internal handoff states and never email. Best-effort — never
  // breaks the transition.
  if (appliedTo === 'paid' || appliedTo === 'failed' || appliedTo === 'refunded' || appliedTo === 'partially_refunded') {
    try {
      const booking = await db.booking.findUnique({
        where: { id: existing.bookingId },
        select: { reference: true, userId: true, contactEmail: true, contactName: true },
      });
      if (booking) {
        const eventType = appliedTo === 'paid' ? 'payment_paid' : appliedTo === 'failed' ? 'payment_failed' : 'payment_refunded';
        const detailUrl = await paymentDetailUrlForCustomer(booking, existing.reference);
        await sendCustomerEmailSafe(eventType, booking.contactEmail, {
          name: booking.contactName,
          reference: existing.reference,
          bookingReference: booking.reference,
          detailUrl,
        }, {
          relatedReference: existing.reference,
          // A payment can have several genuine partial refunds. Anchor
          // refund mail dedupe to the locked cumulative refunded amount:
          // redelivery stays idempotent, while each new refund gets mail.
          idempotencyKey: eventType === 'payment_refunded'
            ? `${eventType}:${existing.reference}:${decimalToCents(row.amountRefunded)}`
            : `${eventType}:${existing.reference}`,
        });
      }
    } catch {
      /* email never breaks the transition */
    }
  }
  return toStaffPaymentView(row);
}

function paymentTransitionAction(from: PaymentStatus, to: PaymentStatus): string {
  void from;
  switch (to) {
    case 'processing': return 'Payment handoff ready';
    case 'paid': return 'Payment completed';
    case 'failed': return 'Payment failed';
    case 'cancelled': return 'Payment cancelled';
    case 'refunded': return 'Payment refunded';
    case 'partially_refunded': return 'Payment partially refunded';
    case 'pending': return 'Payment initiated';
  }
}

export { ACTIVE_PAYMENT_STATUSES, transitionPayment };
