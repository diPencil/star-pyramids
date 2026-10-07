import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { listStaffEventRequests } from '@/lib/server/event-requests';

/** Staff request inbox (full projection incl. internal markers, no activities). */
export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'requests.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const requests = await listStaffEventRequests();
  return NextResponse.json({ requests });
}
