// Phase D: commercial PDF content and voucher verification tests.
// - Invoice models freeze booking snapshots while payments, refunds
//   and the dated balance stay live and labeled;
// - voucher models carry a verifiable QR URL and no money; the public
//   verification reveals only minimal non-sensitive validity data, and
//   cancelled bookings verify as invalid;
// - refund models freeze the anchored event; all three new layouts
//   render structurally valid A4 PDFs without legal/tax rows.
//
// Safety: real database probes deleted in `finally`; emails and staff
// notifications mocked (refunds).

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
import { issueBookingDocument, verifyVoucherToken } from '@/lib/server/documents';
import { loadBookingDocumentPdfModel } from '@/lib/server/document-pdf';
import { renderBookingDocumentPdf } from '@/lib/server/pdf/render';
import {
  cleanupProbe,
  createProbeBooking,
  createProbePayment,
  recordTestRefund,
} from './probe-helpers';

const reachable: boolean = await db
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false);

afterAll(async () => {
  if (reachable) await db.$disconnect().catch(() => undefined);
});

const STAFF_ACTOR = {
  kind: 'staff' as const,
  user: { roles: ['STAFF'], permissions: ['bookings.view'] },
};
const VERIFY_BASE = 'https://verify.example';

describe.runIf(reachable)('commercial invoice PDF content (real database)', () => {
  it('freezes snapshots while payments and the dated balance stay live', async () => {
    const booking = await createProbeBooking({ tag: 'pdf-inv' });
    try {
      const payment = await createProbePayment(booking.id, '200.00');
      await db.payment.update({
        where: { id: payment.id },
        data: { amountPaid: '80.00', status: 'PAID' },
      });
      const issued = await issueBookingDocument({
        type: 'INVOICE',
        bookingReference: booking.reference,
        idempotencyKey: `pdf-inv-${Date.now()}`,
      });
      if (!issued.ok) throw new Error(`issuance failed: ${issued.error}`);

      // Later booking edits must not move the frozen invoice values.
      await db.booking.update({
        where: { id: booking.id },
        data: { total: '999.99', subtotal: '999.99', discount: '50.00' },
      });
      await db.bookingItem.updateMany({
        where: { bookingId: booking.id },
        data: { lineTotal: '999.99', adultUnit: '1.00' },
      });

      const model = await loadBookingDocumentPdfModel(STAFF_ACTOR, issued.document.id, booking.reference, {
        verificationBaseUrl: VERIFY_BASE,
      });
      expect(model).not.toBeNull();
      if (!model) throw new Error('unreachable');
      expect(model.document.type).toBe('INVOICE');
      expect(model.document.typeLabel).toBe('Commercial Invoice');
      expect(model.hideLegalRows).toBe(true);
      expect(model.booking.summary).toBeNull();
      expect(model.receipt).toBeNull();
      expect(model.voucher).toBeNull();
      expect(model.refundNote).toBeNull();

      const invoice = model.invoice;
      expect(invoice).not.toBeNull();
      if (!invoice) throw new Error('unreachable');
      expect(invoice.totalCents).toBe(20000);
      expect(invoice.subtotalCents).toBe(20000);
      expect(invoice.discountCents).toBe(0);
      expect(invoice.lines).toHaveLength(1);
      expect(invoice.lines[0].lineTotalCents).toBe(20000);
      expect(invoice.lines[0].unitPrices).toContain('USD 80.00');
      // Live payment state, explicitly dated.
      expect(invoice.paidToDateCents).toBe(8000);
      expect(invoice.balanceDueCents).toBe(12000);
      expect(typeof invoice.balanceAsOf).toBe('string');

      const bytes = await renderBookingDocumentPdf(model);
      expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(bytes.includes(Buffer.from('%%EOF'))).toBe(true);
    } finally {
      await cleanupProbe([booking.id], [booking.reference], []);
    }
  });
});

describe.runIf(reachable)('booking voucher PDF and verification (real database)', () => {
  it('embeds a verifiable QR, carries no money, and verifies minimally', async () => {
    const booking = await createProbeBooking({ tag: 'pdf-vch', status: 'CONFIRMED' });
    try {
      const issued = await issueBookingDocument({
        type: 'BOOKING_VOUCHER',
        bookingReference: booking.reference,
        idempotencyKey: `pdf-vch-${Date.now()}`,
      });
      if (!issued.ok) throw new Error(`issuance failed: ${issued.error}`);
      const token = issued.document.verificationToken;
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const model = await loadBookingDocumentPdfModel(STAFF_ACTOR, issued.document.id, booking.reference, {
        verificationBaseUrl: VERIFY_BASE,
      });
      expect(model).not.toBeNull();
      if (!model) throw new Error('unreachable');
      expect(model.hideLegalRows).toBe(true);
      expect(model.booking.summary).toBeNull();
      expect(model.invoice).toBeNull();
      expect(model.receipt).toBeNull();
      expect(model.refundNote).toBeNull();

      const voucher = model.voucher;
      expect(voucher).not.toBeNull();
      if (!voucher) throw new Error('unreachable');
      expect(voucher.verificationUrl).toBe(`${VERIFY_BASE}/verify-voucher/${token}`);
      expect(voucher.qrPng).not.toBeNull();
      expect(voucher.qrPng?.subarray(1, 4).toString('latin1')).toBe('PNG');
      expect(voucher.services).toHaveLength(1);
      expect(voucher.services[0].title).toBe('Pyramids & Sphinx Full Day');

      const bytes = await renderBookingDocumentPdf(model);
      expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      // The QR travels as an embedded image object.
      expect(bytes.toString('latin1')).toContain('/Subtype /Image');

      // Public verification: minimal keys only, no private data.
      const verified = await verifyVoucherToken(token ?? '');
      expect(verified.valid).toBe(true);
      expect(verified.reason).toBe('ok');
      expect(Object.keys(verified).sort()).toEqual([
        'issuedAt',
        'reason',
        'serviceStatus',
        'services',
        'valid',
        'voucherNumber',
      ]);
      const raw = JSON.stringify(verified);
      expect(raw).not.toContain('Dana Commercial');
      expect(raw).not.toContain('phased-pdf-vch');
      expect(raw).not.toContain('20000');
      expect(raw).not.toContain(booking.reference);
      expect(verified.services).toEqual([{ title: 'Pyramids & Sphinx Full Day', date: '2026-12-05' }]);

      // Cancelling the booking invalidates the voucher live.
      await db.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
      const cancelled = await verifyVoucherToken(token ?? '');
      expect(cancelled.valid).toBe(false);
      expect(cancelled.reason).toBe('cancelled');
      expect(cancelled.voucherNumber).toBe(issued.document.number);

      expect((await verifyVoucherToken('bad-token')).reason).toBe('not-recognized');
      expect((await verifyVoucherToken('A'.repeat(43))).reason).toBe('not-recognized');
    } finally {
      await cleanupProbe([booking.id], [booking.reference], []);
    }
  });
});

describe.runIf(reachable)('refund note PDF content (real database)', () => {
  it('freezes the anchored refund event on the page', async () => {
    const booking = await createProbeBooking({ tag: 'pdf-rfd' });
    try {
      const payment = await createProbePayment(booking.id, '200.00');
      const refund = await recordTestRefund(payment.reference, '45.50', 'pdf-rfd');
      const issued = await issueBookingDocument({
        type: 'REFUND_NOTE',
        bookingReference: booking.reference,
        paymentReference: payment.reference,
        refundEventId: refund.eventId,
        idempotencyKey: `pdf-rfd-${Date.now()}`,
      });
      if (!issued.ok) throw new Error(`issuance failed: ${issued.error}`);

      const model = await loadBookingDocumentPdfModel(STAFF_ACTOR, issued.document.id, booking.reference, {
        verificationBaseUrl: VERIFY_BASE,
      });
      expect(model).not.toBeNull();
      if (!model) throw new Error('unreachable');
      expect(model.document.typeLabel).toBe('Refund Note');
      expect(model.hideLegalRows).toBe(true);
      expect(model.booking.summary).toBeNull();

      const note = model.refundNote;
      expect(note).not.toBeNull();
      if (!note) throw new Error('unreachable');
      expect(note).toMatchObject({
        paymentReference: payment.reference,
        amountCents: 4550,
        scope: 'partial',
        method: 'bank_transfer',
        externalReference: refund.externalReference,
      });
      expect(typeof note.refundDate).toBe('string');

      const bytes = await renderBookingDocumentPdf(model);
      expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(bytes.includes(Buffer.from('%%EOF'))).toBe(true);
    } finally {
      await cleanupProbe([booking.id], [booking.reference], []);
    }
  });

  it('keeps the original three layouts byte-stable in shape', async () => {
    const booking = await createProbeBooking({ tag: 'pdf-regression' });
    try {
      const issued = await issueBookingDocument({
        type: 'BOOKING_REQUEST',
        bookingReference: booking.reference,
        idempotencyKey: `pdf-regression-${Date.now()}`,
      });
      if (!issued.ok) throw new Error(`issuance failed: ${issued.error}`);
      const model = await loadBookingDocumentPdfModel(STAFF_ACTOR, issued.document.id, booking.reference, {
        verificationBaseUrl: VERIFY_BASE,
      });
      expect(model).not.toBeNull();
      if (!model) throw new Error('unreachable');
      // Original layouts keep legal rows and the shared summary.
      expect(model.hideLegalRows).toBe(false);
      expect(model.invoice).toBeNull();
      expect(model.voucher).toBeNull();
      expect(model.refundNote).toBeNull();
      expect(model.booking.summary).not.toBeNull();
      const bytes = await renderBookingDocumentPdf(model);
      expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    } finally {
      await cleanupProbe([booking.id], [booking.reference], []);
    }
  });
});
