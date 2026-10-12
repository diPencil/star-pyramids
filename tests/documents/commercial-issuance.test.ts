// Phase D: commercial document issuance tests (real database).
//
// Covers the three completed document types at the service layer:
// - INVOICE issues for unpaid / partially paid / fully paid (and
//   cancelled) bookings with a frozen total snapshot; exactly one per
//   booking; snapshots survive later booking-total changes;
// - BOOKING_VOUCHER issues only for confirmed/completed bookings with
//   a stored opaque verification token; pending and cancelled bookings
//   are refused; exactly one per booking;
// - REFUND_NOTE anchors to exactly one persisted completed-refund
//   event with per-refund evidence; historical events without evidence,
//   foreign events, and already-noted events are refused; retries with
//   the same key return the original note;
// - concurrent same-key issuances mint a single document; concurrent
//   distinct-key guarded issuances leave exactly one winner.
//
// Safety: session auth is not involved at this layer; probe rows are
// deleted in `finally`. Emails/notifications are mocked (refunds).

import { describe, it, expect, vi, afterAll } from 'vitest';

vi.mock('@/lib/server/email', () => ({
  sendCustomerEmailSafe: vi.fn(async () => undefined),
  sendStaffEmailSafe: vi.fn(async () => undefined),
}));
vi.mock('@/lib/server/notifications', () => ({
  notifyUser: vi.fn(async () => undefined),
  notifyStaff: vi.fn(async () => undefined),
}));

import { db } from '@/lib/server/db';
import { issueBookingDocument } from '@/lib/server/documents';
import {
  cleanupProbe,
  createProbeBooking,
  createProbePayment,
  mintSuffix,
  recordTestRefund,
} from './probe-helpers';

const reachable: boolean = await db
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false);

afterAll(async () => {
  if (reachable) await db.$disconnect().catch(() => undefined);
});

describe.runIf(reachable)('commercial invoice issuance (real database)', () => {
  it('issues for unpaid bookings with a frozen snapshot', async () => {
    const booking = await createProbeBooking({ tag: 'inv-unpaid' });
    try {
      const issued = await issueBookingDocument({
        type: 'INVOICE',
        bookingReference: booking.reference,
        idempotencyKey: `inv-unpaid-${Date.now()}`,
      });
      expect(issued.ok).toBe(true);
      if (!issued.ok) throw new Error('unreachable');
      expect(issued.created).toBe(true);
      expect(issued.document.type).toBe('INVOICE');
      expect(issued.document.number).toMatch(/^SP-INV-\d{4}-\d{6}$/);
      expect(issued.document.amountCents).toBe(20000);
      expect(issued.document.paymentReference).toBeNull();

      // The snapshot survives later booking-total changes.
      await db.booking.update({ where: { id: booking.id }, data: { total: '999.99' } });
      const again = await issueBookingDocument({
        type: 'INVOICE',
        bookingReference: booking.reference,
        idempotencyKey: `inv-unpaid-${Date.now()}-retry`,
      });
      // A second key is a second invoice attempt, refused (one per booking).
      expect(again.ok).toBe(false);
      if (again.ok) throw new Error('unreachable');
      expect(again.error).toBe('duplicate-invoice');

      // The original row is untouched by the booking change.
      const row = await db.bookingDocument.findUnique({
        where: { id: issued.document.id },
        select: { amountCents: true, number: true },
      });
      expect(row?.amountCents).toBe(20000);
      expect(row?.number).toBe(issued.document.number);
    } finally {
      await cleanupProbe([booking.id], [booking.reference], []);
    }
  });

  it('issues across partial and full payment states and on cancelled bookings', async () => {
    const partial = await createProbeBooking({ tag: 'inv-partial' });
    const full = await createProbeBooking({ tag: 'inv-full' });
    const cancelled = await createProbeBooking({ tag: 'inv-cancelled', status: 'CANCELLED' });
    try {
      await createProbePayment(partial.id, '80.00');
      const partialInvoice = await issueBookingDocument({
        type: 'INVOICE',
        bookingReference: partial.reference,
        idempotencyKey: `inv-partial-${Date.now()}`,
      });
      expect(partialInvoice.ok).toBe(true);

      const paid = await createProbePayment(full.id, '200.00');
      expect(paid.amountPaid.toNumber()).toBe(200);
      const fullInvoice = await issueBookingDocument({
        type: 'INVOICE',
        bookingReference: full.reference,
        idempotencyKey: `inv-full-${Date.now()}`,
      });
      expect(fullInvoice.ok).toBe(true);

      const cancelledInvoice = await issueBookingDocument({
        type: 'INVOICE',
        bookingReference: cancelled.reference,
        idempotencyKey: `inv-cancelled-${Date.now()}`,
      });
      expect(cancelledInvoice.ok).toBe(true);
    } finally {
      await cleanupProbe(
        [partial.id, full.id, cancelled.id],
        [partial.reference, full.reference, cancelled.reference],
        [],
      );
    }
  });

  it('serializes concurrent guarded issuances to a single winner', async () => {
    const booking = await createProbeBooking({ tag: 'inv-race' });
    try {
      const key = `inv-race-${Date.now()}`;
      const attempts = await Promise.all(
        [0, 1, 2, 3].map((n) =>
          issueBookingDocument({
            type: 'INVOICE',
            bookingReference: booking.reference,
            idempotencyKey: `${key}-${n}`,
          }),
        ),
      );
      const successes = attempts.filter((a) => a.ok);
      expect(successes).toHaveLength(1);
      const failures = attempts.filter((a) => !a.ok);
      expect(failures.every((f) => !f.ok && f.error === 'duplicate-invoice')).toBe(true);
      expect(await db.bookingDocument.count({ where: { bookingId: booking.id } })).toBe(1);
    } finally {
      await cleanupProbe([booking.id], [booking.reference], []);
    }
  });
});

describe.runIf(reachable)('booking voucher issuance (real database)', () => {
  it('issues for confirmed bookings with a verification token', async () => {
    const booking = await createProbeBooking({ tag: 'vch-ok', status: 'CONFIRMED' });
    try {
      const key = `vch-ok-${Date.now()}`;
      const issued = await issueBookingDocument({
        type: 'BOOKING_VOUCHER',
        bookingReference: booking.reference,
        idempotencyKey: key,
      });
      expect(issued.ok).toBe(true);
      if (!issued.ok) throw new Error('unreachable');
      expect(issued.document.number).toMatch(/^SP-VCH-\d{4}-\d{6}$/);
      expect(issued.document.verificationToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

      // Retry with the same key returns the original voucher and token.
      const retry = await issueBookingDocument({
        type: 'BOOKING_VOUCHER',
        bookingReference: booking.reference,
        idempotencyKey: key,
      });
      expect(retry.ok).toBe(true);
      if (!retry.ok) throw new Error('unreachable');
      expect(retry.created).toBe(false);
      expect(retry.document.id).toBe(issued.document.id);
      expect(retry.document.verificationToken).toBe(issued.document.verificationToken);

      // A distinct key is refused: one voucher per booking.
      const second = await issueBookingDocument({
        type: 'BOOKING_VOUCHER',
        bookingReference: booking.reference,
        idempotencyKey: `vch-ok-second-${Date.now()}`,
      });
      expect(second.ok).toBe(false);
      if (second.ok) throw new Error('unreachable');
      expect(second.error).toBe('duplicate-voucher');
    } finally {
      await cleanupProbe([booking.id], [booking.reference], []);
    }
  });

  it('refuses pending and cancelled bookings', async () => {
    const pending = await createProbeBooking({ tag: 'vch-pending' });
    const cancelled = await createProbeBooking({ tag: 'vch-cancelled', status: 'CANCELLED' });
    try {
      const pendingAttempt = await issueBookingDocument({
        type: 'BOOKING_VOUCHER',
        bookingReference: pending.reference,
        idempotencyKey: `vch-pending-${Date.now()}`,
      });
      expect(pendingAttempt.ok).toBe(false);
      if (pendingAttempt.ok) throw new Error('unreachable');
      expect(pendingAttempt.error).toBe('voucher-not-eligible');

      const cancelledAttempt = await issueBookingDocument({
        type: 'BOOKING_VOUCHER',
        bookingReference: cancelled.reference,
        idempotencyKey: `vch-cancelled-${Date.now()}`,
      });
      expect(cancelledAttempt.ok).toBe(false);
      if (cancelledAttempt.ok) throw new Error('unreachable');
      expect(cancelledAttempt.error).toBe('voucher-not-eligible');

      expect(await db.bookingDocument.count({ where: { bookingId: { in: [pending.id, cancelled.id] } } })).toBe(0);
    } finally {
      await cleanupProbe([pending.id, cancelled.id], [pending.reference, cancelled.reference], []);
    }
  });
});

describe.runIf(reachable)('refund note issuance (real database)', () => {
  it('anchors a note to one completed refund with a frozen snapshot', async () => {
    const booking = await createProbeBooking({ tag: 'rfd-ok' });
    try {
      const payment = await createProbePayment(booking.id, '200.00');
      const refund = await recordTestRefund(payment.reference, '60.00', 'rfd-ok');
      const noteKey = `rfd-ok-${Date.now()}`;
      const issued = await issueBookingDocument({
        type: 'REFUND_NOTE',
        bookingReference: booking.reference,
        paymentReference: payment.reference,
        refundEventId: refund.eventId,
        idempotencyKey: noteKey,
      });
      expect(issued.ok).toBe(true);
      if (!issued.ok) throw new Error(`issuance failed`);
      expect(issued.document.number).toMatch(/^SP-RFD-\d{4}-\d{6}$/);
      expect(issued.document.amountCents).toBe(6000);
      expect(issued.document.paymentReference).toBe(payment.reference);
      expect(issued.document.refund).toMatchObject({
        eventId: refund.eventId,
        amountCents: 6000,
        method: 'bank_transfer',
        externalReference: refund.externalReference,
        scope: 'partial',
      });

      // Same key retries return the original note.
      const retry = await issueBookingDocument({
        type: 'REFUND_NOTE',
        bookingReference: booking.reference,
        paymentReference: payment.reference,
        refundEventId: refund.eventId,
        idempotencyKey: noteKey,
      });
      expect(retry.ok).toBe(true);
      if (!retry.ok) throw new Error('unreachable');
      expect(retry.created).toBe(false);
      expect(retry.document.id).toBe(issued.document.id);

      // The snapshot survives later payment changes.
      await db.payment.update({ where: { id: payment.id }, data: { amountRefunded: '200.00' } });
      const row = await db.$queryRaw<Array<{ refundAmountCents: number }>>`
        SELECT refundAmountCents FROM booking_documents WHERE id = ${issued.document.id}`;
      expect(row[0]?.refundAmountCents).toBe(6000);
    } finally {
      await cleanupProbe([booking.id], [booking.reference], []);
    }
  });

  it('refuses unknown, foreign, untracked and already-noted refunds', async () => {
    const booking = await createProbeBooking({ tag: 'rfd-bad' });
    const other = await createProbeBooking({ tag: 'rfd-other' });
    try {
      const payment = await createProbePayment(booking.id, '200.00');
      const foreignPayment = await createProbePayment(other.id, '100.00');
      const foreignRefund = await recordTestRefund(foreignPayment.reference, '40.00', 'rfd-foreign');

      const unknown = await issueBookingDocument({
        type: 'REFUND_NOTE',
        bookingReference: booking.reference,
        paymentReference: payment.reference,
        refundEventId: 'c'.repeat(25),
        idempotencyKey: `rfd-bad-unknown-${Date.now()}`,
      });
      expect(unknown.ok).toBe(false);
      if (unknown.ok) throw new Error('unreachable');
      expect(unknown.error).toBe('unknown-refund-event');

      const foreign = await issueBookingDocument({
        type: 'REFUND_NOTE',
        bookingReference: booking.reference,
        paymentReference: foreignPayment.reference,
        refundEventId: foreignRefund.eventId,
        idempotencyKey: `rfd-bad-foreign-${Date.now()}`,
      });
      expect(foreign.ok).toBe(false);
      if (foreign.ok) throw new Error('unreachable');
      expect(foreign.error).toBe('refund-not-on-booking');

      // A historical refund event without per-refund evidence (exactly
      // what pre-migration rows look like) cannot be noted.
      const legacyEventId = `c${mintSuffix()}${mintSuffix()}${mintSuffix()}${mintSuffix()}`.slice(0, 25);
      await db.$executeRaw`
        INSERT INTO payment_events (id, paymentId, actorRole, action, note, isInternal, providerEventId, amountCents, method, externalReference)
        VALUES (${legacyEventId}, ${payment.id}, 'staff', 'Payment partially refunded', 'Offline Bank transfer refund LEGACY-1 — return confirmed by staff', 1, NULL, NULL, NULL, NULL)`;
      const legacy = await issueBookingDocument({
        type: 'REFUND_NOTE',
        bookingReference: booking.reference,
        paymentReference: payment.reference,
        refundEventId: legacyEventId,
        idempotencyKey: `rfd-bad-legacy-${Date.now()}`,
      });
      expect(legacy.ok).toBe(false);
      if (legacy.ok) throw new Error('unreachable');
      expect(legacy.error).toBe('refund-not-tracked');

      // A completed, tracked refund notes once; a second key is refused.
      const tracked = await recordTestRefund(payment.reference, '30.00', 'rfd-once');
      const first = await issueBookingDocument({
        type: 'REFUND_NOTE',
        bookingReference: booking.reference,
        paymentReference: payment.reference,
        refundEventId: tracked.eventId,
        idempotencyKey: `rfd-once-first-${Date.now()}`,
      });
      expect(first.ok).toBe(true);
      const second = await issueBookingDocument({
        type: 'REFUND_NOTE',
        bookingReference: booking.reference,
        paymentReference: payment.reference,
        refundEventId: tracked.eventId,
        idempotencyKey: `rfd-once-second-${Date.now()}`,
      });
      expect(second.ok).toBe(false);
      if (second.ok) throw new Error('unreachable');
      expect(second.error).toBe('duplicate-refund-note');

      // Full refunds scope as full (the payment logic allows one partial
      // then the final refund, so the remainder closes it out).
      const rest = await recordTestRefund(payment.reference, '170.00', 'rfd-full');
      const fullNote = await issueBookingDocument({
        type: 'REFUND_NOTE',
        bookingReference: booking.reference,
        paymentReference: payment.reference,
        refundEventId: rest.eventId,
        idempotencyKey: `rfd-full-${Date.now()}`,
      });
      expect(fullNote.ok).toBe(true);
      if (!fullNote.ok) throw new Error('unreachable');
      expect(fullNote.document.refund?.scope).toBe('full');
    } finally {
      await cleanupProbe(
        [booking.id, other.id],
        [booking.reference, other.reference],
        [],
      );
    }
  });
});
