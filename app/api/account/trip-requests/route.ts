import { NextResponse } from 'next/server';

import { listCustomerTripRequests } from '@/lib/server/trip-requests';
import { getAccountReadUser } from '@/lib/server/staff-preview';

/** Authenticated customer's own trip requests (safe projection). */
export async function GET() {
  const current = await getAccountReadUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const requests = await listCustomerTripRequests(current.id);
  return NextResponse.json({ requests });
}
