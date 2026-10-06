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

import { randomInt } from 'node:crypto';
import { Prisma, PaymentStatus as DbStatus } from '@prisma/client';

import { db } from './db';
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
const BOOKING_REF_PATTERN = /^(SP-BK-[A-Z0-9]{6}|SP-[A-Z0-9]{10})$/;

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
    currency: 'USD',
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
  payments: { status: PaymentStatus; amountPaidCents: number; amountRefundedCents: number; reference: string; createdAt: Date }[],
  bookingTotalCents: number,
): BookingPaymentSummary {
  const ordered = [...payments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const paidTotal = payments
    .filter((p) => p.status === 'paid' || p.status === 'partially_refunded' || p.status === 'refunded')
    .reduce((sum, p) => sum + p.amountPaidCents, 0);
  const refundedTotal = payments.reduce((sum, p) => sum + p.amountRefundedCents, 0);
  const latest = ordered[0];
  if (!latest) {
    return { state: 'unpaid', payments: 0, paidTotal: 0, latestReference: null };
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
  const totalCents = decimalToCents(booking.total);
  if (totalCents <= 0) throw new Error('This booking has no amount due.');

  if (input.idempotencyKey !== '') {
    const existingByKey = await db.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: paymentInclude,
    });
    if (existingByKey) return { payment: toCustomerPaymentView(existingByKey), created: false };
  }

  const active = await db.payment.findFirst({
    where: { bookingId: booking.id, status: { in: ['PENDING', 'PROCESSING'] } },
    orderBy: { createdAt: 'desc' },
    include: paymentInclude,
  });
  if (active) return { payment: toCustomerPaymentView(active), created: false };

  let lastError: unknown = null;
  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt += 1) {
    const reference = mintReferenceCandidate();
    try {
      const row = await db.payment.create({
        data: {
          reference,
          bookingId: booking.id,
          provider: 'pending',
          status: 'PENDING',
          currency: 'USD',
          amount: centsToDecimal(totalCents),
          amountPaid: centsToDecimal(0),
          amountRefunded: centsToDecimal(0),
          idempotencyKey: input.idempotencyKey === '' ? null : input.idempotencyKey,
          events: {
            create: { actorRole: 'customer', action: 'Payment initiated' },
          },
        },
        include: paymentInclude,
      });
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
          if (winner) return { payment: toCustomerPaymentView(winner), created: false };
        }
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not initiate the payment. Please try again.');
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

/**
 * Single enforced applier for server-side payment transitions
 * (Phase 2F-B provider webhooks, audited offline workflows). NOT
 * reachable from any Phase 2F-A route: no browser input can change
 * payment status. Amounts are validated in integer cents.
 */
export async function transitionPayment(
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
  },
): Promise<StaffPayment | null> {
  const existing = await db.payment.findUnique({ where: { reference } });
  if (!existing) return null;
  const current = FROM_DB_STATUS[existing.status];
  if (!canTransitionPayment(current, to)) {
    throw new Error('This payment change is not allowed.');
  }
  const amountPaidCents = options.amountPaidCents ?? decimalToCents(existing.amountPaid);
  const amountRefundedCents = options.amountRefundedCents ?? decimalToCents(existing.amountRefunded);
  if (amountPaidCents < 0 || amountRefundedCents < 0 || amountRefundedCents > amountPaidCents) {
    throw new Error('Invalid payment amounts.');
  }
  const now = new Date();
  const row = await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: existing.id },
      data: {
        status: TO_DB_STATUS[to],
        amountPaid: centsToDecimal(amountPaidCents),
        amountRefunded: centsToDecimal(amountRefundedCents),
        ...(options.providerPaymentId ? { providerPaymentId: options.providerPaymentId } : {}),
        ...(options.failureCode ? { failureCode: options.failureCode.slice(0, 64) } : {}),
        ...(options.failureMessage ? { failureMessage: options.failureMessage.slice(0, 255) } : {}),
        ...(to === 'paid' ? { paidAt: now } : {}),
        ...(to === 'failed' ? { failedAt: now } : {}),
        ...(to === 'cancelled' ? { cancelledAt: now } : {}),
        ...(to === 'refunded' || to === 'partially_refunded' ? { refundedAt: now } : {}),
        events: {
          create: {
            actorRole: options.actor,
            action: paymentTransitionAction(current, to),
            note: options.note?.slice(0, 1000) || null,
            isInternal: options.internal ?? true,
          },
        },
      },
    });
    return tx.payment.findUnique({ where: { id: existing.id }, include: paymentInclude });
  });
  if (!row) return null;
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

export { ACTIVE_PAYMENT_STATUSES };
