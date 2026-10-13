import { NextResponse } from 'next/server';

import { listCustomerEventRequests } from '@/lib/server/event-requests';
import { getAccountReadUser } from '@/lib/server/staff-preview';

/** Owner-only request list (customer-safe projection, no activities). */
export async function GET() {
  const current = await getAccountReadUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const requests = await listCustomerEventRequests(current.id);
  return NextResponse.json({ requests });
}
