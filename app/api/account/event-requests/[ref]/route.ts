import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  cancelCustomerEventRequest,
  getCustomerEventRequest,
} from '@/lib/server/event-requests';

async function requireCustomer() {
  const current = await getCurrentUser();
  if (!current) return null;
  if (!current.roles.includes('CUSTOMER')) return null;
  return current;
}

function refOf(ctx: { params: Promise<{ ref: string }> }): Promise<string> {
  return ctx.params.then((p) => p.ref);
}

/** Owner-only request detail. Missing and foreign requests share one 404. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ ref: string }> },
) {
  const current = await requireCustomer();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const reference = decodeURIComponent(await refOf(ctx));
  const item = await getCustomerEventRequest(current.id, reference);
  if (!item) return NextResponse.json({ error: 'Event request not found.' }, { status: 404 });
  return NextResponse.json(item);
}

type CustomerPatchBody = {
  action?: unknown;
};

/**
 * Owner-only mutation. Only `cancel` (while new/reviewing) exists —
 * requests are never customer-edited. Status, ownership, and references
 * are never accepted from the browser and are enforced in the service.
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
  const reference = decodeURIComponent(await refOf(ctx));

  let body: CustomerPatchBody;
  try {
    body = (await request.json()) as CustomerPatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  try {
    if (body.action === 'cancel') {
      const item = await cancelCustomerEventRequest(current.id, reference);
      if (!item) return NextResponse.json({ error: 'Event request not found.' }, { status: 404 });
      return NextResponse.json(item);
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
