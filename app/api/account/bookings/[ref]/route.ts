import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  cancelCustomerBooking,
  getCustomerBooking,
} from '@/lib/server/bookings';

async function requireCustomer() {
  const current = await getCurrentUser();
  if (!current) return null;
  if (!current.roles.includes('CUSTOMER')) return null;
  return current;
}

/** Owner-only booking detail (customer-safe projection). */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ ref: string }> },
) {
  const current = await requireCustomer();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const reference = decodeURIComponent((await ctx.params).ref);
  const booking = await getCustomerBooking(current.id, reference);
  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  return NextResponse.json(booking);
}

/**
 * Owner-only cancel. Only pending/confirmed bookings can be cancelled;
 * the server enforces the transition — the browser sends no status.
 */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ ref: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await requireCustomer();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const reference = decodeURIComponent((await ctx.params).ref);

  let body: { action?: unknown };
  try {
    body = (await request.json()) as { action?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (body.action !== 'cancel') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  try {
    const booking = await cancelCustomerBooking(current.id, reference);
    if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    return NextResponse.json(booking);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
