import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { listCustomerEventRequests } from '@/lib/server/event-requests';

async function requireCustomer() {
  const current = await getCurrentUser();
  if (!current) return null;
  if (!current.roles.includes('CUSTOMER')) return null;
  return current;
}

/** Owner-only request list (customer-safe projection, no activities). */
export async function GET() {
  const current = await requireCustomer();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const requests = await listCustomerEventRequests(current.id);
  return NextResponse.json({ requests });
}
