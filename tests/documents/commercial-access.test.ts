// Phase D: commercial document route tests (real database).
//
// - POST /api/admin/bookings/[ref]/documents issues invoices, vouchers
//   and refund notes behind `bookings.edit` with stable machine codes
//   for every refusal, and audits every creation;
// - GET staff lists include refund-event options with tracking flags;
// - owner and guest PDF downloads serve the new types through the
//   unchanged access gates (uniform 404s, cross-booking isolation).
//
// Safety: session auth is mocked at the getCurrentUser boundary;
// emails/notifications are mocked; probe rows are deleted in `finally`.

import { describe, it, expect, vi, afterAll } from 'vitest';

vi.mock('@/lib/server/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/auth')>();
  return { ...actual, getCurrentUser: vi.fn(async () => null) };
});
vi.mock('@/lib/server/email', () => ({
  sendCustomerEmailSafe: vi.fn(async () => undefined),
  sendStaffEmailSafe: vi.fn(async () => undefined),
}));
vi.mock('@/lib/server/notifications', () => ({
  notifyUser: vi.fn(async () => undefined),
  notifyStaff: vi.fn(async () => undefined),
}));

import { getCurrentUser } from '@/lib/server/auth';
import { issueGuestBookingToken } from '@/lib/server/booking-access';
import { issueBookingDocument } from '@/lib/server/documents';
import { db } from '@/lib/server/db';
import { GET as staffList, POST as staffIssue } from '@/app/api/admin/bookings/[ref]/documents/route';
import { GET as ownerPdf } from '@/app/api/account/bookings/[ref]/documents/[documentId]/pdf/route';
import { GET as guestPdf } from '@/app/api/bookings/access/[token]/documents/[documentId]/pdf/route';
import {
  cleanupProbe,
  createProbeBooking,
  createProbePayment,
  createProbeUser,
  ctx,
  recordTestRefund,
  staffUser,
} from './probe-helpers';

const reachable: boolean = await db
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false);

afterAll(async () => {
  if (reachable) await db.$disconnect().catch(() => undefined);
});

const mockGetCurrentUser = vi.mocked(getCurrentUser);

const ORIGIN_HEADERS = {
  'content-type': 'application/json',
  origin: 'http://localhost:3000',
  'x-forwarded-host': 'localhost:3000',
};

function post(ref: string, body: unknown) {
  return staffIssue(
    new Request(`http://localhost/api/admin/bookings/${ref}/documents`, {
      method: 'POST',
      headers: ORIGIN_HEADERS,
      body: JSON.stringify(body),
    }),
    ctx({ ref }),
  );
}

function customerUser(id: string) {
  return { id, publicId: 'p', email: 'owner@example.com', roles: ['CUSTOMER'], permissions: [] } as never;
}

describe.runIf(reachable)('commercial issuance routes (real database)', () => {
  it('issues invoices, vouchers and refund notes with audits behind bookings.edit', async () => {
    const booking = await createProbeBooking({ tag: 'route-ok', status: 'CONFIRMED' });
    const staff = await createProbeUser('route-staff');
    try {
      const payment = await createProbePayment(booking.id, '200.00');
      const refund = await recordTestRefund(payment.reference, '50.00', 'route-ok');

      // View-only staff cannot issue the new types either.
      mockGetCurrentUser.mockResolvedValue(staffUser(['bookings.view', 'payments.view']));
      const viewerInvoice = await post(booking.reference, {
        type: 'INVOICE',
        idempotencyKey: `route-viewer-${Date.now()}`,
      });
      expect(viewerInvoice.status).toBe(403);

      mockGetCurrentUser.mockResolvedValue(staffUser(['bookings.edit'], staff.id));

      const invoice = await post(booking.reference, {
        type: 'INVOICE',
        idempotencyKey: `route-inv-${Date.now()}`,
      });
      expect(invoice.status).toBe(201);
      const invoiceBody = (await invoice.json()) as { created: boolean; document: { number: string } };
      expect(invoiceBody.created).toBe(true);
      expect(invoiceBody.document.number).toMatch(/^SP-INV-\d{4}-\d{6}$/);

      const voucher = await post(booking.reference, {
        type: 'BOOKING_VOUCHER',
        idempotencyKey: `route-vch-${Date.now()}`,
      });
      expect(voucher.status).toBe(201);

      const note = await post(booking.reference, {
        type: 'REFUND_NOTE',
        paymentReference: payment.reference,
        refundEventId: refund.eventId,
        idempotencyKey: `route-rfd-${Date.now()}`,
      });
      expect(note.status).toBe(201);
      const noteBody = (await note.json()) as { created: boolean; document: { number: string } };
      expect(noteBody.document.number).toMatch(/^SP-RFD-\d{4}-\d{6}$/);

      // Duplicate invoice with a fresh key is a 409, not a document.
      const dupInvoice = await post(booking.reference, {
        type: 'INVOICE',
        idempotencyKey: `route-inv-dup-${Date.now()}`,
      });
      expect(dupInvoice.status).toBe(409);
      expect(await dupInvoice.json()).toEqual({
        error: 'An invoice was already issued for this booking.',
        code: 'duplicate-invoice',
      });

      expect(
        await db.staffActionAudit.count({
          where: { action: 'booking.document_issued', entityId: booking.reference },
        }),
      ).toBe(3);
    } finally {
      mockGetCurrentUser.mockResolvedValue(null);
      await cleanupProbe([booking.id], [booking.reference], [staff.id]);
    }
  });

  it('refuses ineligible vouchers and untracked refunds with stable codes', async () => {
    const pending = await createProbeBooking({ tag: 'route-pending' });
    try {
      mockGetCurrentUser.mockResolvedValue(staffUser(['bookings.edit']));

      const voucher = await post(pending.reference, {
        type: 'BOOKING_VOUCHER',
        idempotencyKey: `route-vch-pending-${Date.now()}`,
      });
      expect(voucher.status).toBe(409);
      expect(await voucher.json()).toEqual({
        error: 'Vouchers need a confirmed booking.',
        code: 'voucher-not-eligible',
      });

      const payment = await createProbePayment(pending.id, '100.00');
      const noEvent = await post(pending.reference, {
        type: 'REFUND_NOTE',
        paymentReference: payment.reference,
        refundEventId: 'c'.repeat(25),
        idempotencyKey: `route-rfd-noevent-${Date.now()}`,
      });
      expect(noEvent.status).toBe(400);
      expect((await noEvent.json()) as { code: string }).toMatchObject({ code: 'unknown-refund-event' });

      expect(await db.bookingDocument.count({ where: { bookingId: pending.id } })).toBe(0);
    } finally {
      mockGetCurrentUser.mockResolvedValue(null);
      await cleanupProbe([pending.id], [pending.reference], []);
    }
  });

  it('lists refund events with tracking flags for the admin dialog', async () => {
    const booking = await createProbeBooking({ tag: 'route-events' });
    try {
      const payment = await createProbePayment(booking.id, '150.00');
      const refund = await recordTestRefund(payment.reference, '25.00', 'route-events');

      mockGetCurrentUser.mockResolvedValue(staffUser(['bookings.view']));
      const res = await staffList(
        new Request(`http://localhost/api/admin/bookings/${booking.reference}/documents`),
        ctx({ ref: booking.reference }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        refundEvents: Array<{
          id: string;
          paymentReference: string;
          scope: string;
          amountCents: number | null;
          tracked: boolean;
        }>;
      };
      expect(body.refundEvents).toHaveLength(1);
      expect(body.refundEvents[0]).toMatchObject({
        id: refund.eventId,
        paymentReference: payment.reference,
        scope: 'partial',
        amountCents: 2500,
        tracked: true,
      });
    } finally {
      mockGetCurrentUser.mockResolvedValue(null);
      await cleanupProbe([booking.id], [booking.reference], []);
    }
  });
});

describe.runIf(reachable)('commercial PDF downloads (real database)', () => {
  it('serves invoices, vouchers and refund notes to owners and guests with isolation', async () => {
    const owner = await createProbeUser('route-owner');
    const booking = await createProbeBooking({ userId: owner.id, tag: 'route-dl', status: 'CONFIRMED' });
    const other = await createProbeBooking({ userId: null, tag: 'route-dl-other', status: 'CONFIRMED' });
    try {
      const payment = await createProbePayment(booking.id, '200.00');
      const refund = await recordTestRefund(payment.reference, '200.00', 'route-dl');
      const docs: Record<string, string> = {};
      for (const [type, input] of [
        ['INVOICE', {}],
        ['BOOKING_VOUCHER', {}],
        ['REFUND_NOTE', { paymentReference: payment.reference, refundEventId: refund.eventId }],
      ] as const) {
        const issued = await issueBookingDocument({
          type,
          bookingReference: booking.reference,
          ...input,
          idempotencyKey: `route-dl-${type}-${Date.now()}`,
        });
        if (!issued.ok) throw new Error(`${type} failed: ${issued.error}`);
        docs[type] = issued.document.id;
      }
      const otherVoucher = await issueBookingDocument({
        type: 'BOOKING_VOUCHER',
        bookingReference: other.reference,
        idempotencyKey: `route-dl-other-${Date.now()}`,
      });
      if (!otherVoucher.ok) throw new Error('other voucher failed');

      // Owner downloads each new type with the right filename pattern.
      mockGetCurrentUser.mockResolvedValue(customerUser(owner.id));
      for (const [type, pattern] of [
        ['INVOICE', /^attachment; filename="SP-INV-\d{4}-\d{6}\.pdf"$/],
        ['BOOKING_VOUCHER', /^attachment; filename="SP-VCH-\d{4}-\d{6}\.pdf"$/],
        ['REFUND_NOTE', /^attachment; filename="SP-RFD-\d{4}-\d{6}\.pdf"$/],
      ] as const) {
        const res = await ownerPdf(
          new Request(`http://localhost/api/account/bookings/${booking.reference}/documents/${docs[type]}/pdf`),
          ctx({ ref: booking.reference, documentId: docs[type] }),
        );
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('application/pdf');
        expect(res.headers.get('content-disposition') ?? '').toMatch(pattern);
        const bytes = Buffer.from(await res.arrayBuffer());
        expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      }

      // Guest downloads through the token; cross-booking stays 404.
      const minted = await issueGuestBookingToken(other.reference);
      if (!minted) throw new Error('guest token failed');
      mockGetCurrentUser.mockResolvedValue(null);
      const guestOther = await guestPdf(
        new Request(`http://localhost/api/bookings/access/${minted.token}/documents/${otherVoucher.document.id}/pdf`, {
          headers: { 'x-forwarded-for': '10.8.8.1' },
        }),
        ctx({ token: minted.token, documentId: otherVoucher.document.id }),
      );
      expect(guestOther.status).toBe(200);

      const guestCross = await guestPdf(
        new Request(`http://localhost/api/bookings/access/${minted.token}/documents/${docs['INVOICE']}/pdf`, {
          headers: { 'x-forwarded-for': '10.8.8.2' },
        }),
        ctx({ token: minted.token, documentId: docs['INVOICE'] }),
      );
      expect(guestCross.status).toBe(404);
      expect(await guestCross.json()).toEqual({ error: 'Document not found.' });
    } finally {
      mockGetCurrentUser.mockResolvedValue(null);
      await cleanupProbe(
        [booking.id, other.id],
        [booking.reference, other.reference],
        [owner.id],
      );
    }
  }, 15_000);
});
