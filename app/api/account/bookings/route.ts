import { NextResponse } from 'next/server';

import { listCustomerBookings } from '@/lib/server/bookings';
import { getAccountReadUser } from '@/lib/server/staff-preview';

/** Owner-only booking list (customer-safe projection). */
export async function GET() {
  const current = await getAccountReadUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const bookings = await listCustomerBookings(current.id);
  return NextResponse.json({ bookings });
}
