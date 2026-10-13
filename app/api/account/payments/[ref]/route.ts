import { NextResponse } from 'next/server';

import { getCustomerPayment } from '@/lib/server/payments';
import { getAccountReadUser } from '@/lib/server/staff-preview';

/** Owner-only payment detail (customer-safe projection). */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ ref: string }> },
) {
  const current = await getAccountReadUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const reference = decodeURIComponent((await ctx.params).ref);
  const payment = await getCustomerPayment(current.id, reference);
  if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
  return NextResponse.json(payment);
}
