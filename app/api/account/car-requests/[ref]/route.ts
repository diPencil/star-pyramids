import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  cancelCustomerCarRequest,
  getCustomerCarRequest,
  updateCustomerCarRequest,
  validateCarDraft,
} from '@/lib/server/car-requests';

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
  const item = await getCustomerCarRequest(current.id, reference);
  if (!item) return NextResponse.json({ error: 'Car request not found.' }, { status: 404 });
  return NextResponse.json(item);
}

type CustomerPatchBody = {
  action?: unknown;
  draft?: unknown;
};

/**
 * Owner-only mutation. Only `update` (while new/reviewing) and `cancel`
 * exist — status, ownership, and references are never accepted from the
 * browser and are enforced inside the service instead.
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
      const item = await cancelCustomerCarRequest(current.id, reference);
      if (!item) return NextResponse.json({ error: 'Car request not found.' }, { status: 404 });
      return NextResponse.json(item);
    }
    if (body.action === 'update') {
      const draft = validateCarDraft(body.draft);
      const item = await updateCustomerCarRequest(current.id, reference, draft);
      if (!item) return NextResponse.json({ error: 'Car request not found.' }, { status: 404 });
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
