import { NextResponse } from 'next/server';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { listStaffPayments } from '@/lib/server/payments';
import { PAYMENT_STATUSES, type PaymentStatus } from '@/lib/payment';
import { recordOfflinePayment, recordOfflineRefund } from '@/lib/server/payments';
import { BOOKING_STATUSES, type BookingStatus } from '@/lib/booking';
import { isSameOriginRequest } from '@/lib/server/csrf';

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
  if (!hasPermission(current, 'payments.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
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

/**
 * Staff: record a verified offline payment (cash/bank transfer).
 * The body carries the booking reference, received amount, method,
 * optional reference note, and an idempotency key. Returns the
 * created payment receipt or a duplicate if the key was already used.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'payments.edit')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // Validate required fields
  const bookingReference = typeof body.bookingReference === 'string' ? body.bookingReference.trim() : '';
  if (!bookingReference) return NextResponse.json({ error: 'Booking reference is required.' }, { status: 400 });

  const amount = typeof body.amount === 'number' && Number.isFinite(body.amount) && body.amount > 0 ? body.amount : null;
  if (!amount) return NextResponse.json({ error: 'Valid amount is required.' }, { status: 400 });

  const method = typeof body.method === 'string' && (body.method === 'bank_transfer' || body.method === 'cash') ? body.method : null;
  if (!method) return NextResponse.json({ error: 'Valid payment method is required.' }, { status: 400 });

  const currency = typeof body.currency === 'string' && body.currency === 'USD' ? 'USD' : null;
  if (!currency) return NextResponse.json({ error: 'USD currency is required.' }, { status: 400 });

  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  if (!idempotencyKey) return NextResponse.json({ error: 'Idempotency key is required.' }, { status: 400 });

  try {
    const result = await recordOfflinePayment({
      bookingReference,
      amount,
      currency,
      method,
      referenceNote: typeof body.referenceNote === 'string' ? body.referenceNote : undefined,
      idempotencyKey,
    });
    if (!result) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    return NextResponse.json({ created: result.created, payment: result.payment });
  } catch (error: any) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}