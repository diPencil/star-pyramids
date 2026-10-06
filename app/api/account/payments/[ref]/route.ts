import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { getCustomerPayment } from '@/lib/server/payments';

async function requireCustomer() {
  const current = await getCurrentUser();
  if (!current) return null;
  if (!current.roles.includes('CUSTOMER')) return null;
  return current;
}

/** Owner-only payment detail (customer-safe projection). */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ ref: string }> },
) {
  const current = await requireCustomer();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const reference = decodeURIComponent((await ctx.params).ref);
  const payment = await getCustomerPayment(current.id, reference);
  if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
  return NextResponse.json(payment);
}
