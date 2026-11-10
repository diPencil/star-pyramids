import { NextResponse } from 'next/server';

import { listCustomerBookings } from '@/lib/server/booking/bookings';
import { getAccountReadUser } from '@/lib/server/auth/staff-preview';

/** Owner-only booking list (customer-safe projection). */
export async function GET() {
  const current = await getAccountReadUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const bookings = await listCustomerBookings(current.id);
  return NextResponse.json({ bookings });
}
