import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { listCustomerBookings } from '@/lib/server/bookings';

async function requireCustomer() {
  const current = await getCurrentUser();
  if (!current) return null;
  if (!current.roles.includes('CUSTOMER')) return null;
  return current;
}

/** Owner-only booking list (customer-safe projection). */
export async function GET() {
  const current = await requireCustomer();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const bookings = await listCustomerBookings(current.id);
  return NextResponse.json({ bookings });
}
