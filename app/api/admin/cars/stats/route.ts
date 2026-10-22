import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { getCarBookingCounts } from '@/lib/server/cars';

/** Admin fleet booking stats: confirmed car transfers per assigned vehicle. */
export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'cars.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const counts = await getCarBookingCounts();
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return NextResponse.json({
    stats: {
      totalConfirmedBookings: total,
      bookingsByVehicle: Object.fromEntries(counts),
    },
  });
}
