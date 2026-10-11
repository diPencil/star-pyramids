import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { PaidOnCancelledBooking, recordOfflinePayment } from '@/lib/server/payments';

type RecordBody = {
  bookingReference?: unknown;
  amount?: unknown;
  currency?: unknown;
  method?: unknown;
  referenceNote?: unknown;
  idempotencyKey?: unknown;
};

/**
 * Staff-only offline receipt recording (cash / bank transfer).
 * Gated by `payments.edit`; every success is audited. The service
 * owns validation, balance checks, idempotency and the PAID
 * transition — the browser supplies details only, never statuses.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'payments.edit')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let body: RecordBody;
  try {
    body = (await request.json()) as RecordBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const audit = (action: string, metadata?: Record<string, unknown>) =>
    db.staffActionAudit
      .create({
        data: {
          actorId: current.id,
          action,
          entityType: 'payment',
          entityId:
            typeof body.bookingReference === 'string' ? body.bookingReference.trim() : null,
          ...(metadata ? { metadata: JSON.stringify(metadata) } : {}),
        },
      })
      .catch(() => undefined);

  try {
    const result = await recordOfflinePayment({
      bookingReference: typeof body.bookingReference === 'string' ? body.bookingReference : '',
      amount: typeof body.amount === 'number' ? body.amount : Number.NaN,
      currency: typeof body.currency === 'string' ? body.currency : '',
      method: typeof body.method === 'string' ? body.method : '',
      referenceNote: typeof body.referenceNote === 'string' ? body.referenceNote : '',
      idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '',
    });
    if (!result) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    await audit('payment.record_offline', {
      reference: result.payment.reference,
      created: result.created,
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof PaidOnCancelledBooking) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
