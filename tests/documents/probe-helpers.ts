// Phase D shared probe helpers (real database).
//
// Booking/payment/refund fixtures for the commercial-document tests.
// Probe rows are deleted by each test's own cleanup. Emails and staff
// notifications are mocked by the importing test file (these helpers
// never send anything themselves).
import { db } from '@/lib/server/db';
import { recordOfflineRefund } from '@/lib/server/payments';

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function mintSuffix(): string {
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  }
  return suffix;
}

export function staffUser(permissions: string[], id = 'staff-phaseD-probe') {
  return { id, publicId: 'p', email: 'staff@example.com', roles: ['STAFF'], permissions } as never;
}

export function ctx(params: Record<string, string>) {
  return { params: Promise.resolve(params) };
}

export async function createProbeUser(tag: string) {
  const email = `phased-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  return db.user.create({
    data: { email, emailNormalized: email.toLowerCase(), status: 'ACTIVE' },
    select: { id: true },
  });
}

export async function createProbeBooking(opts: {
  userId?: string | null;
  tag: string;
  total?: string;
  status?: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
}) {
  const reference = `SP-BK-${mintSuffix()}`;
  const total = opts.total ?? '200.00';
  return db.booking.create({
    data: {
      reference,
      userId: opts.userId ?? null,
      contactName: 'Dana Commercial',
      contactEmail: `phased-${opts.tag}-${Date.now()}@example.com`,
      contactPhone: '+20100111222',
      currency: 'USD',
      subtotal: total,
      discount: '0.00',
      total,
      status: opts.status ?? 'PENDING',
      paymentStatus: 'PENDING',
      idempotencyKey: `phased-${opts.tag}-${Date.now()}-${reference}`,
      items: {
        create: {
          tourSlug: 'pyramids-sphinx',
          tourTitle: 'Pyramids & Sphinx Full Day',
          travelDate: '2026-12-05',
          adults: 2,
          children: 1,
          infants: 0,
          addons: '["Lunch","Private guide"]',
          adultUnit: '80.00',
          childUnit: '40.00',
          infantUnit: '0.00',
          addonTotal: '0.00',
          lineTotal: total,
        },
      },
    },
  });
}

export async function createProbePayment(bookingId: string, amountPaid: string) {
  const reference = `SP-PAY-${mintSuffix()}`;
  return db.payment.create({
    data: {
      reference,
      bookingId,
      provider: 'offline',
      status: 'PAID',
      currency: 'USD',
      amount: amountPaid,
      amountPaid,
      amountRefunded: '0.00',
      paidAt: new Date(),
      idempotencyKey: `phased-pay-${Date.now()}-${reference}`,
    },
  });
}

export interface RecordedTestRefund {
  eventId: string;
  externalReference: string;
  amountCents: number;
}

/**
 * Records a genuinely completed offline refund through the real
 * service (so the refund event carries per-refund evidence) and
 * returns the persisted event's identity.
 */
export async function recordTestRefund(
  paymentReference: string,
  amountDollars: string,
  tag: string,
): Promise<RecordedTestRefund> {
  const externalReference = `TEST-EXT-${tag}-${Date.now()}`;
  const amountCents = Math.round(Number(amountDollars) * 100);
  const recorded = await recordOfflineRefund({
    paymentReference,
    amount: Number(amountDollars),
    method: 'bank_transfer',
    externalReference,
    confirmReturned: true,
  });
  if (!recorded.created) throw new Error('test refund was not recorded');
  // The service returns a safe staff projection, not the internal payment id.
  // Anchor the fixture to the exact persisted refund instead of letting an
  // undefined Prisma filter select another test's newest global event.
  const [event] = await db.$queryRaw<Array<{ id: string }>>`
    SELECT e.id
    FROM payment_events AS e
    JOIN payments AS p ON p.id = e.paymentId
    WHERE p.reference = ${paymentReference}
      AND (e.action = 'Payment refunded' OR e.action = 'Payment partially refunded')
      AND e.amountCents = ${amountCents}
      AND e.externalReference = ${externalReference}
    LIMIT 1`;
  if (!event) throw new Error('test refund event not found');
  return { eventId: event.id, externalReference, amountCents };
}

export async function cleanupProbe(bookingIds: string[], bookingRefs: string[], userIds: string[]) {
  // Extension columns live on the document rows themselves, so deleting
  // the documents removes them — no separate cleanup needed.
  await db.bookingDocument.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => undefined);
  await db.bookingAccessToken.deleteMany({ where: { bookingRef: { in: bookingRefs } } }).catch(() => undefined);
  await db.payment.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => undefined);
  await db.bookingActivity.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => undefined);
  await db.bookingItem.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => undefined);
  await db.booking.deleteMany({ where: { id: { in: bookingIds } } }).catch(() => undefined);
  await db.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
  await db.staffActionAudit
    .deleteMany({ where: { action: 'booking.document_issued', entityId: { in: bookingRefs } } })
    .catch(() => undefined);
}
