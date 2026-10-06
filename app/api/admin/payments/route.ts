import { NextResponse } from 'next/server';

import { getCurrentUser, isStaff } from '@/lib/server/auth';
import { listStaffPayments } from '@/lib/server/payments';
import { PAYMENT_STATUSES, type PaymentStatus } from '@/lib/payment';

const STATUS_SET = new Set<string>(PAYMENT_STATUSES);

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return undefined;
  return new Date(time);
}

/**
 * Staff payment list with status/date/search filters. Read-only in
 * Phase 2F-A: no mutation, no status editing, no provider-ID editing.
 */
export async function GET(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!isStaff(current)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  if (statusParam !== null && !STATUS_SET.has(statusParam)) {
    return NextResponse.json({ error: 'Invalid status filter.' }, { status: 400 });
  }
  const payments = await listStaffPayments({
    ...(statusParam ? { status: statusParam as PaymentStatus } : {}),
    query: url.searchParams.get('q')?.slice(0, 120) || undefined,
    from: parseDate(url.searchParams.get('from')),
    to: parseDate(url.searchParams.get('to')),
  });
  return NextResponse.json({ payments });
}
