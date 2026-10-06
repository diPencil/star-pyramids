import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  initiateCustomerPayment,
  listCustomerPayments,
  validatePaymentInitiation,
} from '@/lib/server/payments';
import {
  checkPaymentRateLimit,
  recordPaymentAttempt,
} from '@/lib/server/rate-limit';

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

async function requireCustomer() {
  const current = await getCurrentUser();
  if (!current) return null;
  if (!current.roles.includes('CUSTOMER')) return null;
  return current;
}

/** Owner-only payment list (customer-safe projection). */
export async function GET() {
  const current = await requireCustomer();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const payments = await listCustomerPayments(current.id);
  return NextResponse.json({ payments });
}

/**
 * Owner-only initiation. The body carries the booking reference ONLY —
 * amounts, statuses, providers, and ownership always come from the
 * server session and the stored booking, never the browser. Creates a
 * legitimate PENDING payment awaiting provider handoff; never paid.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await requireCustomer();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const ip = clientIp(request);
  const limit = await checkPaymentRateLimit(current.email, ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many payment attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  let input;
  try {
    input = validatePaymentInitiation(body);
  } catch (error) {
    await recordPaymentAttempt(current.email, ip);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request.' },
      { status: 400 },
    );
  }

  try {
    const { payment, created } = await initiateCustomerPayment(current.id, input);
    await recordPaymentAttempt(current.email, ip);
    return NextResponse.json(payment, { status: created ? 201 : 200 });
  } catch (error) {
    await recordPaymentAttempt(current.email, ip);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
