import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { listStaffCarRequests } from '@/lib/server/car-requests';

/** Staff car-request inbox (full operational projection). */
export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'requests.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const requests = await listStaffCarRequests();
  return NextResponse.json({ requests });
}
