import { NextResponse } from 'next/server';

import { listCustomerCarRequests } from '@/lib/server/car-requests';
import { getAccountReadUser } from '@/lib/server/staff-preview';

/** Authenticated customer's own car requests (safe projection). */
export async function GET() {
  const current = await getAccountReadUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const requests = await listCustomerCarRequests(current.id);
  return NextResponse.json({ requests });
}
