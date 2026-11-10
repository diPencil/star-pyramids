// Booking domain service (Phase 2E). Server owns validation,
// reference issuance, ownership, pricing, status lifecycle, and
// response shaping. The browser supplies SELECTIONS ONLY (slugs,
// dates, headcounts, add-on titles, contact)  -  never prices, totals,
// statuses, references, user linkage, or payment state.
import 'server-only';

import { randomInt } from 'node:crypto';
import { type BookingMeasurementReceipt } from '../../tracking/leads/booking-measurement';
import { Prisma, PaymentStatus as DbPaymentStatus } from '@prisma/client';

import { db } from '../db';
import { readJsonText, writeJsonText } from '../../json-text';

import { BOOKING_FINANCIAL_REVIEW_CODE, bookingCancelExposure, canTransitionBooking, labelForBookingTransition, type Booking, type BookingStatus, type StaffBooking } from '@/lib/booking/booking';
import { FROM_DB_PAYMENT_STATUS } from '../payments/payments';
import { notifyUser, notifyStaff } from '../notifications/notifications';
import { sendCustomerEmailSafe, sendStaffEmailSafe } from '../email/email';
import { guestBookingPath, issueGuestBookingToken, revokeGuestBookingTokens } from './access/booking-access';
import { TO_DB_STATUS, FROM_DB_STATUS, NOTE_MAX, centsToDecimal, decimalToCents, hasControlChars } from './booking-values';

import type { ValidatedBookingDraft } from './booking-validation';
import { toCustomerView, toStaffView, rowInclude } from './booking-read-models';
import type { BookingRow } from './booking-read-models';

import { ATTEMPT_ACTION, bookingConsentProof, bookingMeasurement, assertCheckoutReplay } from './booking-replay';
import type { CheckoutWriteOptions } from './booking-replay';
export { findCheckoutReplay } from './booking-replay';

export { listCustomerBookings, getCustomerBooking, getGuestBooking, listStaffBookings, getStaffBooking } from './booking-queries';

export { toCustomerView, toStaffView } from './booking-read-models';

export { validateBookingDraft } from './booking-validation';
export type { ValidatedBookingLine, ValidatedBookingDraft } from './booking-validation';

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const REF_ATTEMPTS = 5;

/**
 * Thrown when a booking cannot be cancelled without financial review:
 * captured money is at stake and no verified refund exists. Routes map
 * `code` to a localized explanation; the booking and every payment row
 * are left exactly as they were. Re-exported for route error mapping.
 */
export class BookingFinancialReviewError extends Error {
  readonly code = BOOKING_FINANCIAL_REVIEW_CODE;
  constructor() {
    super(
      'This booking has captured or in-flight payments and needs financial review before it can be cancelled.',
    );
    this.name = 'BookingFinancialReviewError';
  }
}

export { BOOKING_FINANCIAL_REVIEW_CODE };

/** Prisma "record not found" from a conditional update (lost update race). */
function isRecordConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2025'
  );
}

/**
 * Financial safeguard shared by customer and staff cancellation. MUST
 * run inside the booking-cancel transaction (same `tx` handle):
 * - payment rows are locked and re-read (FOR UPDATE: current committed
 *   state, never a stale snapshot)  -  same booking→payments lock order
 *   as the settlement path, so the two can never deadlock;
 * - captured money (paid − refunded > 0) → throws, rolling the whole
 *   cancellation back so status and payment history stay untouched;
 * - pending/processing attempts only → voids them with conditional
 *   writes (a settled row never matches, so a void can NEVER
 *   overwrite PAID) plus one audit event each;
 * - otherwise (unpaid, failed attempts, fully refunded) → no-op.
 */
async function assertCancellableMoney(
  tx: Prisma.TransactionClient,
  bookingId: string,
  actorRole: 'customer' | 'staff',
): Promise<void> {
  const rows = await tx.$queryRaw<
    Array<{ id: string; status: string; amountPaid: unknown; amountRefunded: unknown }>
  >`SELECT id, status, amountPaid, amountRefunded FROM payments WHERE bookingId = ${bookingId} FOR UPDATE`;
  const exposure = bookingCancelExposure(
    rows.map((row) => ({
      status: FROM_DB_PAYMENT_STATUS[row.status as DbPaymentStatus],
      amountPaidCents: decimalToCents(row.amountPaid as Prisma.Decimal | number | string),
      amountRefundedCents: decimalToCents(row.amountRefunded as Prisma.Decimal | number | string),
    })),
  );
  if (exposure === 'captured') {
    throw new BookingFinancialReviewError();
  }
  if (exposure === 'inflight') {
    const now = new Date();
    for (const row of rows) {
      if (row.status !== 'PENDING' && row.status !== 'PROCESSING') continue;
      const voided = await tx.payment.updateMany({
        where: { id: row.id, status: row.status as DbPaymentStatus },
        data: { status: 'CANCELLED', cancelledAt: now },
      });
      if (voided.count === 0) {
        // Unreachable while the rows above stay locked, but a void
        // must never silently skip: fail retryable instead.
        throw new Error('Payment changed concurrently; retry the cancellation.');
      }
      await tx.paymentEvent.create({
        data: {
          paymentId: row.id,
          actorRole,
          action: 'Payment attempt cancelled with booking',
          isInternal: true,
        },
      });
    }
  }
}

/**
 * Shown to guests above their private link so the one-off nature of the
 * link is explicit. Empty for account bookings, which keeps their existing
 * copy byte-identical.
 */
const GUEST_ACCESS_NOTE =
  'You booked as a guest, so this private link is your access to the booking. ';

/**
 * Resolve the correct link for the booking owner: a private guest link for
 * guest bookings, the account detail page for account bookings.
 *
 * `rotate` revokes any previously issued guest link before minting a new
 * one, so exactly one guest link is ever live (the newest email wins)  -
 * the same "latest link is authoritative" model as password reset.
 */
async function ownerBookingLink(
  reference: string,
  isGuest: boolean,
  rotate: boolean,
): Promise<{ detailUrl: string; accessNote: string }> {
  if (!isGuest) {
    return {
      detailUrl: `/account/bookings/detail?ref=${encodeURIComponent(reference)}`,
      accessNote: '',
    };
  }
  if (rotate) await revokeGuestBookingTokens(reference);
  const issued = await issueGuestBookingToken(reference);
  // No token means no booking row (or it belongs to an account after all).
  // Fall back to the reference-based link rather than leaking an empty URL.
  if (!issued) {
    return {
      detailUrl: `/account/bookings/detail?ref=${encodeURIComponent(reference)}`,
      accessNote: '',
    };
  }
  return { detailUrl: guestBookingPath(issued.token), accessNote: GUEST_ACCESS_NOTE };
}

function mintReferenceCandidate(): string {
  let suffix = '';
  for (let i = 0; i < 6; i += 1) suffix += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `SP-BK-${suffix}`;
}

/** Integer-cents helpers: every persisted commercial amount is computed
 *  in cents and stored as DECIMAL  -  never float arithmetic. */
function toCents(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) return 0;
  return Math.round(usd * 100);
}

/**
 * Create exactly one booking for a checkout submission. A repeated
 * submission with the same idempotency key returns the original booking
 * instead of creating a duplicate.
 */
export async function createBookingRecord(
  userId: string | null,
  draft: ValidatedBookingDraft,
  checkout?: CheckoutWriteOptions,
): Promise<{ booking: Booking; created: boolean; guestAccessUrl: string | null; bookingMeasurement?: BookingMeasurementReceipt }> {
  const assertReplayOwnership = (row: BookingRow) => {
    if(checkout){assertCheckoutReplay(row,userId,checkout.fingerprint);return;}
    if (row.userId !== userId) throw new Error('That submission key was already used for a different booking.');
    // Bind every replay (account and guest) to its original request. An account
    // must not receive an unrelated old booking after changing a cart under the same key.
    {
      const requested = draft.lines.map((line) => JSON.stringify([
        line.tourSlug, line.travelDate, line.adults, line.children, line.infants,
        [...line.addons].sort(), line.adultUnitCents, line.childUnitCents,
        line.infantUnitCents, line.addonTotalCents, line.lineTotalCents,
      ])).sort();
      const stored = row.items.map((line) => {
        const addons = readJsonText(line.addons);
        return JSON.stringify([
          line.tourSlug, line.travelDate, line.adults, line.children, line.infants,
          Array.isArray(addons) ? [...addons].sort() : [], decimalToCents(line.adultUnit),
          decimalToCents(line.childUnit), decimalToCents(line.infantUnit),
          decimalToCents(line.addonTotal), decimalToCents(line.lineTotal),
        ]);
      }).sort();
      if (row.contactName !== draft.contactName || row.contactEmail !== draft.contactEmail ||
        row.contactPhone !== draft.contactPhone || (row.notes ?? '') !== draft.notes || row.currency !== 'USD' ||
        decimalToCents(row.total) !== draft.totalCents || decimalToCents(row.subtotal) !== draft.subtotalCents ||
        decimalToCents(row.discount) !== draft.discountCents || JSON.stringify(stored) !== JSON.stringify(requested)) {
        throw new Error('That submission key was already used for a different booking.');
      }
      if (typeof draft.accountConsent === 'boolean' && row.activities.some(activity => activity.action === 'Checkout account consent accepted') !== draft.accountConsent) throw new Error('That submission key was already used for a different booking.');
    }
  };
  const existingByKey = draft.idempotencyKey
    ? await db.booking.findUnique({ where: { idempotencyKey: draft.idempotencyKey }, include: rowInclude })
    : null;
  if (existingByKey) {
    assertReplayOwnership(existingByKey);
    return { booking: toCustomerView(existingByKey), created: false, guestAccessUrl: null };
  }

  const measurement = checkout?.measurement && draft.idempotencyKey ? checkout.measurement : undefined;
  const proof = measurement && draft.idempotencyKey ? bookingConsentProof(draft.idempotencyKey, measurement) : undefined;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt += 1) {
    const reference = mintReferenceCandidate();
    try {
      const data:Prisma.BookingUncheckedCreateInput = {
          reference,
          userId,
          contactName: draft.contactName,
          contactEmail: draft.contactEmail,
          contactPhone: draft.contactPhone,
          notes: draft.notes === '' ? null : draft.notes,
          currency: 'USD',
          subtotal: centsToDecimal(draft.subtotalCents),
          discount: centsToDecimal(draft.discountCents),
          total: centsToDecimal(draft.totalCents),
          status: 'PENDING',
          paymentStatus: 'PENDING',
          idempotencyKey: draft.idempotencyKey,
          items: {
            create: draft.lines.map((line) => ({
              tourSlug: line.tourSlug,
              tourTitle: line.tourTitle,
              tourImage: line.tourImage === '' ? null : line.tourImage,
              travelDate: line.travelDate,
              adults: line.adults,
              children: line.children,
              infants: line.infants,
              addons: writeJsonText(line.addons),
              adultUnit: centsToDecimal(line.adultUnitCents),
              childUnit: centsToDecimal(line.childUnitCents),
              infantUnit: centsToDecimal(line.infantUnitCents),
              addonTotal: centsToDecimal(line.addonTotalCents),
              lineTotal: centsToDecimal(line.lineTotalCents),
            })),
          },
          activities: {
            create: [{ actorRole: 'customer', action: 'Booking created' }, ...(draft.accountConsent ? [{actorRole:'customer',action:'Checkout account consent accepted'}] : []), ...(checkout?[{actorRole:'system',action:ATTEMPT_ACTION,isInternal:true,note:JSON.stringify({fingerprint:checkout.fingerprint,owner:userId,measurement:proof})}]:[])],
          },
        };
      const row = checkout?.persist ? await checkout.persist(data) : await db.booking.create({data,include:rowInclude});
      // Guest checkouts (userId NULL) have no account to log into, so a
      // private expiring link is minted and emailed to them. Account
      // bookings keep the existing session-owned customer link.
      const access = await ownerBookingLink(reference, userId === null, true)
        .catch(() => ({ detailUrl: '', accessNote: '' }));
      const { detailUrl, accessNote } = userId === null && !access.detailUrl.startsWith('/booking/')
        ? { detailUrl: '', accessNote: '' } : access;
      // Receipt for the new booking. Idempotent replays return early
      // above with created:false, so a retried key never notifies twice.
      // Guests (userId NULL) are skipped  -  no account to notify.
      await Promise.resolve().then(() => notifyUser(userId, {
        type: 'booking_created',
        title: 'Booking received',
        message: `We received your booking ${reference}. Track its status here.`,
        href: `/account/bookings/detail?ref=${encodeURIComponent(reference)}`,
      })).catch(() => undefined);
      // Operational copy for staff (guests included). Runs only on the
      // created path above, so idempotent replays never double-notify.
      await Promise.resolve().then(() => notifyStaff({
        type: 'admin_booking_created',
        title: 'New booking received',
        message: `Booking ${reference} needs review.`,
        href: `/admin/bookings/${encodeURIComponent(reference)}`,
      })).catch(() => undefined);
      // Email receipts (best-effort  -  never break booking creation).
      // Customer copy goes to the address given at checkout (guests
      // included); staff copy goes to the configured operational
      // recipient. Idempotency key matches the booking reference so a
      // retried submission never sends twice.
      if (detailUrl) await sendCustomerEmailSafe('booking_created', draft.contactEmail, {
        name: draft.contactName,
        reference,
        tourTitle: draft.lines.map((line) => line.tourTitle).join(', '),
        total: (draft.totalCents / 100).toFixed(2),
        currency: 'USD',
        detailUrl,
        accessNote,
      }, { relatedReference: reference, idempotencyKey: `booking_created:${reference}` }).catch(()=>undefined);
      await sendStaffEmailSafe('admin_booking_created', {
        name: draft.contactName,
        reference,
        total: (draft.totalCents / 100).toFixed(2),
        currency: 'USD',
        detailUrl: `/admin/bookings/${encodeURIComponent(reference)}`,
      }, { relatedReference: reference, idempotencyKey: `admin_booking_created:${reference}` }).catch(()=>undefined);
      return {
        booking: toCustomerView(row),
        created: true,
        bookingMeasurement: bookingMeasurement(row, measurement),
        // Guests get their private link back so the confirmation screen can
        // show it immediately. Account bookings use their session instead,
        // so they receive null and nothing changes for them.
        guestAccessUrl: userId === null && detailUrl.startsWith('/booking/') ? detailUrl : null,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Idempotency-key race: another request won  -  return the winner.
        const target = (error.meta?.target as string[] | undefined) ?? [];
        if (target.includes('idempotencyKey')) {
          const winner = await db.booking.findUnique({
            where: { idempotencyKey: draft.idempotencyKey },
            include: rowInclude,
          });
          if (winner) {
            assertReplayOwnership(winner);
            return { booking: toCustomerView(winner), created: false, guestAccessUrl: null };
          }
        }
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not create the booking. Please try again.');
}

export async function cancelCustomerBooking(
  userId: string,
  reference: string,
): Promise<Booking | null> {
  const existing = await db.booking.findUnique({
    where: { reference },
    select: { id: true, userId: true, status: true },
  });
  if (!existing || !existing.userId || existing.userId !== userId) return null;
  const current = FROM_DB_STATUS[existing.status];
  if (current === 'cancelled') {
    // Idempotent retry: already settled, return the current view with
    // no new activity row and no state change.
    const settled = await db.booking.findUnique({ where: { reference }, include: rowInclude });
    if (settled && settled.userId === userId) return toCustomerView(settled);
    return null;
  }
  if (!canTransitionBooking(current, 'cancelled')) {
    throw new Error('This booking can no longer be cancelled.');
  }
  let row;
  try {
    row = await db.$transaction(async (tx) => {
      // Conditional claim: only one concurrent cancellation wins.
      await tx.booking.update({
        where: { id: existing.id, status: { in: ['PENDING', 'CONFIRMED'] } },
        data: {
          status: 'CANCELLED',
          activities: {
            create: { actorRole: 'customer', action: labelForBookingTransition(current, 'cancelled') },
          },
        },
      });
      await assertCancellableMoney(tx, existing.id, 'customer');
      return tx.booking.findUnique({ where: { id: existing.id }, include: rowInclude });
    });
  } catch (error) {
    if (isRecordConflict(error)) {
      // A concurrent cancellation won the race: return the settled view
      // instead of stacking a duplicate activity row and notification.
      const reread = await db.booking.findUnique({ where: { reference }, include: rowInclude });
      if (reread && reread.userId === userId && FROM_DB_STATUS[reread.status] === 'cancelled') {
        return toCustomerView(reread);
      }
      throw new Error('This booking can no longer be cancelled.');
    }
    throw error;
  }
  if (!row) return null;
  return toCustomerView(row);
}

export async function transitionStaffBooking(
  reference: string,
  to: BookingStatus,
  note: string,
  internal: boolean,
): Promise<StaffBooking | null> {
  const existing = await db.booking.findUnique({
    where: { reference },
    select: { id: true, status: true, userId: true },
  });
  if (!existing) return null;
  const current = FROM_DB_STATUS[existing.status];
  if (current === 'cancelled' && to === 'cancelled') {
    // Idempotent retry: already settled, return the current view with
    // no new activity row, no notification, and no email.
    const settled = await db.booking.findUnique({ where: { reference }, include: rowInclude });
    if (settled) return toStaffView(settled);
    return null;
  }
  if (!canTransitionBooking(current, to)) {
    throw new Error('This status change is not allowed.');
  }
  if (note.length > NOTE_MAX || hasControlChars(note)) {
    throw new Error('Notes must be 1,000 characters or fewer.');
  }
  // A duplicate concurrent cancellation resolves to the settled view
  // without re-notifying the customer or stacking activity rows.
  let alreadyCancelled = false;
  let row;
  try {
    row = await db.$transaction(async (tx) => {
      // Cancellations claim the row conditionally so concurrent requests
      // cannot both write; the money guard runs in the same transaction.
      await tx.booking.update({
        where: to === 'cancelled'
          ? { id: existing.id, status: { in: ['PENDING', 'CONFIRMED'] } }
          : { id: existing.id },
        data: {
          status: TO_DB_STATUS[to],
          activities: {
            create: {
              actorRole: 'staff',
              action: labelForBookingTransition(current, to),
              note: note === '' ? null : note,
              isInternal: note === '' ? false : internal,
            },
          },
        },
      });
      if (to === 'cancelled') {
        await assertCancellableMoney(tx, existing.id, 'staff');
      }
      return tx.booking.findUnique({ where: { id: existing.id }, include: rowInclude });
    });
  } catch (error) {
    if (to === 'cancelled' && isRecordConflict(error)) {
      const reread = await db.booking.findUnique({ where: { reference }, include: rowInclude });
      if (reread && FROM_DB_STATUS[reread.status] === 'cancelled') {
        alreadyCancelled = true;
        row = reread;
      } else {
        throw new Error('This status change is not allowed.');
      }
    } else {
      throw error;
    }
  }
  if (!row) return null;
  if (to === 'cancelled' && alreadyCancelled) return toStaffView(row);
  // Customer-visible status changes only. The transition guard above
  // rejects repeats, so each status notifies at most once. Internal
  // notes travel through addStaffBookingNote and never notify.
  if (to === 'confirmed' || to === 'completed' || to === 'cancelled') {
    const copy =
      to === 'confirmed'
        ? { title: 'Booking confirmed', message: `Your booking ${reference} is confirmed. View the details here.` }
        : to === 'completed'
          ? { title: 'Booking completed', message: `Your booking ${reference} is marked completed. Thank you for travelling with us.` }
          : { title: 'Booking cancelled', message: `Your booking ${reference} was cancelled. Contact us if you need anything else.` };
    await notifyUser(existing.userId, {
      type: to === 'confirmed' ? 'booking_confirmed' : to === 'completed' ? 'booking_completed' : 'booking_cancelled',
      ...copy,
      href: `/account/bookings/detail?ref=${encodeURIComponent(reference)}`,
    });
    // Status-change email to the booking contact snapshot (guests
    // included). Transition guard rejects repeats, and the
    // idempotency key adds a second layer against duplicate sends.
    // Guests receive a freshly rotated private link: the previous one is
    // revoked so only the newest email stays usable.
    const { detailUrl, accessNote } = await ownerBookingLink(
      reference,
      existing.userId === null,
      true,
    );
    await sendCustomerEmailSafe(
      to === 'confirmed' ? 'booking_confirmed' : to === 'completed' ? 'booking_completed' : 'booking_cancelled',
      row.contactEmail,
      {
        name: row.contactName,
        reference,
        detailUrl,
        accessNote,
      },
      { relatedReference: reference, idempotencyKey: `booking_${to}:${reference}` },
    );
  }
  return toStaffView(row);
}

export async function addStaffBookingNote(reference: string, note: string): Promise<StaffBooking | null> {
  const trimmed = note.trim();
  if (trimmed === '' || trimmed.length > NOTE_MAX || hasControlChars(trimmed)) {
    throw new Error('Enter an internal note (1,000 characters or fewer).');
  }
  const existing = await db.booking.findUnique({
    where: { reference },
    select: { id: true },
  });
  if (!existing) return null;
  const row = await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: existing.id },
      data: {
        activities: {
          create: { actorRole: 'staff', action: 'Internal note added', note: trimmed, isInternal: true },
        },
      },
    });
    return tx.booking.findUnique({ where: { id: existing.id }, include: rowInclude });
  });
  if (!row) return null;
  return toStaffView(row);
}
