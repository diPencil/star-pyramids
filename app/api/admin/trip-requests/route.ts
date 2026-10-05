import { NextResponse } from 'next/server';

import { getCurrentUser, isStaff } from '@/lib/server/auth';
import { listStaffTripRequests } from '@/lib/server/trip-requests';

/** Staff trip-request inbox (full operational projection). */
export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!isStaff(current)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const requests = await listStaffTripRequests();
  return NextResponse.json({ requests });
}
