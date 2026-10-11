import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { recordOfflineRefund } from '@/lib/server/payments';

type RefundBody = {
  amount?: unknown;
  method?: unknown;
  externalReference?: unknown;
  note?: unknown;
  confirmReturned?: unknown;
};

/**
 * Staff-only offline refund recording (money already returned outside
 * the website). Gated by `payments.edit`; every success is audited.
 * The service owns validation, balance checks and the transition —
 * the browser supplies details only, never statuses.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ ref: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'payments.edit')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const paymentReference = decodeURIComponent((await ctx.params).ref);

  let body: RefundBody;
  try {
    body = (await request.json()) as RefundBody;
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
          entityId: paymentReference,
          ...(metadata ? { metadata: JSON.stringify(metadata) } : {}),
        },
      })
      .catch(() => undefined);

  try {
    const result = await recordOfflineRefund({
      paymentReference,
      amount: typeof body.amount === 'number' ? body.amount : Number.NaN,
      method: typeof body.method === 'string' ? body.method : '',
      externalReference:
        typeof body.externalReference === 'string' ? body.externalReference : '',
      note: typeof body.note === 'string' ? body.note : '',
      confirmReturned: body.confirmReturned,
    });
    await audit('payment.record_offline_refund', {
      reference: result.payment.reference,
      created: result.created,
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
