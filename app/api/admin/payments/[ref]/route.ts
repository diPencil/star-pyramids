import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { getStaffPayment } from '@/lib/server/payments';

/** Staff payment detail (staff projection with linked account). */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ ref: string }> },
) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'payments.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const reference = decodeURIComponent((await ctx.params).ref);
  const payment = await getStaffPayment(reference);
  if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
  return NextResponse.json(payment);
}
