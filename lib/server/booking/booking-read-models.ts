import 'server-only';
import { Prisma } from '@prisma/client';
import { readJsonText } from '../../json-text';
import { derivePaymentProofs, type Booking, type BookingActivity, type BookingLine, type BookingPaymentStatus, type StaffBooking } from '@/lib/booking/booking';
import { deriveBookingPaymentSummary, FROM_DB_PAYMENT_STATUS } from '../payments/payments';
import { FROM_DB_STATUS, decimalToCents, dollars } from './booking-values';
export type BookingRow = Prisma.BookingGetPayload<{
  include: {
    items: true;
    activities: true;
    payments: { select: { status: true; amountPaid: true; amountRefunded: true; reference: true; createdAt: true; currency: true } };
    user: { select: { email: true; firstName: true; lastName: true } };
  };
}>;

function accountName(row: BookingRow): string {
  if (!row.user) return '';
  const full = `${row.user.firstName ?? ''} ${row.user.lastName ?? ''}`.trim();
  return full || row.user.email;
}

function toLineViews(row: Pick<BookingRow, 'items'>): BookingLine[] {
  return [...row.items]
    .sort((a, b) => a.tourSlug.localeCompare(b.tourSlug))
    .map((item, index) => {
      const storedAddons = readJsonText(item.addons);
      const addons = Array.isArray(storedAddons)
        ? storedAddons.filter((entry): entry is string => typeof entry === 'string')
        : [];
      return {
        key: `${item.tourSlug}|${item.travelDate || 'open'}|${item.adults}|${item.children}|${item.infants}|${index}`,
        tourSlug: item.tourSlug,
        title: item.tourTitle,
        image: item.tourImage ?? '',
        date: item.travelDate,
        adults: item.adults,
        children: item.children,
        infants: item.infants,
        addons,
        addonTotal: dollars(decimalToCents(item.addonTotal)),
        adultUnit: dollars(decimalToCents(item.adultUnit)),
        childUnit: dollars(decimalToCents(item.childUnit)),
        infantUnit: dollars(decimalToCents(item.infantUnit)),
        total: dollars(decimalToCents(item.lineTotal)),
      };
    });
}

function toActivityViews(
  activities: BookingRow['activities'],
  includeInternal: boolean,
): BookingActivity[] {
  return [...activities]
    .filter((a) => includeInternal || !a.isInternal)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((a) => ({
      at: a.createdAt.toISOString(),
      by: (a.actorRole === 'staff' || a.actorRole === 'system' ? a.actorRole : 'customer') as BookingActivity['by'],
      action: a.action,
      ...(a.note ? { note: a.note } : {}),
      ...(includeInternal && a.isInternal ? { internal: true as const } : {}),
    }));
}

/**
 * Customer-safe projection: no database IDs, no user linkage, no
 * internal activity. Internal activity rows are excluded entirely so
 * staff notes never reach customer responses. The payment state is
 * DERIVED from real Payment rows (never browser input): bookings
 * with no payment record stay honestly unpaid.
 */
export function toCustomerView(row: BookingRow): Booking {
  const storedPayment: BookingPaymentStatus =
    row.paymentStatus === 'PAID' ? 'paid' : row.paymentStatus === 'REFUNDED' ? 'refunded' : 'pending';
  const summary = deriveBookingPaymentSummary(
    row.payments.map((p) => ({
      currency: p.currency,
      status: FROM_DB_PAYMENT_STATUS[p.status],
      amountPaidCents: decimalToCents(p.amountPaid),
      amountRefundedCents: decimalToCents(p.amountRefunded),
      reference: p.reference,
      createdAt: p.createdAt,
    })),
    decimalToCents(row.total),
    row.currency,
  );
  const paymentStatus: BookingPaymentStatus =
    summary.state === 'paid' ? 'paid' : summary.state === 'refunded' ? 'refunded' : storedPayment;
  // Customer-visible proofs only: internal staff rows never reach
  // customer responses, and review rows carry the customer's own
  // reference, so the timeline stays honest without leaking anything.
  const paymentProofs = derivePaymentProofs(
    row.activities
      .filter((a) => !a.isInternal)
      .map((a) => ({ action: a.action, note: a.note ?? '', at: a.createdAt.toISOString() })),
  );
  return {
    reference: row.reference,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    status: FROM_DB_STATUS[row.status],
    paymentStatus,
    paymentSummary: summary,
    paymentProofs,
    subtotal: dollars(decimalToCents(row.subtotal)),
    discount: dollars(decimalToCents(row.discount)),
    total: dollars(decimalToCents(row.total)),
    currency: row.currency,
    contact: {
      name: row.contactName,
      email: row.contactEmail,
      phone: row.contactPhone,
    },
    notes: row.notes ?? '',
    lines: toLineViews(row),
    activity: toActivityViews(row.activities, false),
  };
}

/** Staff projection: everything customer-safe plus the linked account. */
export function toStaffView(row: BookingRow): StaffBooking {
  const base = toCustomerView(row);
  return {
    ...base,
    activity: toActivityViews(row.activities, true),
    account: row.user ? { email: row.user.email, name: accountName(row) } : null,
    // Staff see every proof against the full timeline (including
    // internal rows), so the pending-review indicator is complete.
    paymentProofs: derivePaymentProofs(
      row.activities.map((a) => ({ action: a.action, note: a.note ?? '', at: a.createdAt.toISOString() })),
    ),
  };
}

export const paymentSelect: Prisma.BookingInclude['payments'] = {
  select: {
    currency: true,
    status: true,
    amountPaid: true,
    amountRefunded: true,
    reference: true,
    createdAt: true,
  },
};

export const rowInclude = {
  items: true,
  activities: true,
  payments: paymentSelect,
  user: { select: { email: true, firstName: true, lastName: true } },
} satisfies Prisma.BookingInclude;
