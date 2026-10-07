import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { listStaffBookings } from '@/lib/server/bookings';

/** Staff booking inbox (full projection, no activities in list rows). */
export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'bookings.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const bookings = await listStaffBookings();
  return NextResponse.json({ bookings });
}
