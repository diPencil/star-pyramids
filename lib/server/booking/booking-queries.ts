import 'server-only';
import { db } from '../db';
import { type Booking, type StaffBooking } from '@/lib/booking/booking';
import { GuestBookingAccessError, resolveGuestBookingToken } from './access/booking-access';
import { paymentSelect, rowInclude, toCustomerView, toStaffView } from './booking-read-models';
export async function listCustomerBookings(userId: string): Promise<Booking[]> {
  const rows = await db.booking.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { items: true, activities: false, payments: paymentSelect, user: false },
  });
  return rows.map((row) =>
    toCustomerView({ ...row, activities: [], user: null }),
  );
}

export async function getCustomerBooking(
  userId: string,
  reference: string,
): Promise<Booking | null> {
  const row = await db.booking.findUnique({
    where: { reference },
    include: rowInclude,
  });
  // Guest bookings (userId NULL) never match an authenticated customer.
  if (!row || !row.userId || row.userId !== userId) return null;
  return toCustomerView(row);
}

/**
 * Guest booking read, authorised ONLY by a valid access token.
 *
 * The reference is derived from the token server-side; it is never accepted
 * from the caller. Read-only on purpose  -  a guest link never cancels, pays,
 * or mutates anything, so a leaked link cannot cost a traveller money.
 * Returns the same customer-safe projection as the authenticated flow.
 */
export async function getGuestBooking(rawToken: string): Promise<Booking> {
  const { reference } = await resolveGuestBookingToken(rawToken);
  const row = await db.booking.findUnique({ where: { reference }, include: rowInclude });
  // A token pointing at a booking that has since gained an account is
  // served through the account flow instead, so ownership never forks.
  if (!row || row.userId) {
    throw new GuestBookingAccessError('not-found');
  }
  return toCustomerView(row);
}

export async function listStaffBookings(): Promise<StaffBooking[]> {
  const rows = await db.booking.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: true, activities: false, payments: paymentSelect, user: { select: { email: true, firstName: true, lastName: true } } },
  });
  return rows.map((row) =>
    toStaffView({ ...row, activities: [] }),
  );
}

export async function getStaffBooking(reference: string): Promise<StaffBooking | null> {
  const row = await db.booking.findUnique({
    where: { reference },
    include: rowInclude,
  });
  if (!row) return null;
  return toStaffView(row);
}
