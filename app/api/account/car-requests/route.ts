import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { listCustomerCarRequests } from '@/lib/server/car-requests';

/** Authenticated customer's own car requests (safe projection). */
export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!current.roles.includes('CUSTOMER')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const requests = await listCustomerCarRequests(current.id);
  return NextResponse.json({ requests });
}
