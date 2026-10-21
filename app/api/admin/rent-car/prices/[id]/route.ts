// Staff-only price edit/delete (Phase 2). Mode switches re-enforce the
// MANUAL/AUTOMATIC invariants; nothing here is publicly reachable.
import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/server/csrf';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { deleteCarRoutePrice, updateCarRoutePrice } from '@/lib/server/car-pricing';

async function requirePermission(request: Request, permission: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { denied: true as const, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) };
  }
  if (!hasPermission(user, permission)) {
    return { denied: true as const, response: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) };
  }
  if (!isSameOriginRequest(request)) {
    return { denied: true as const, response: NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 }) };
  }
  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requirePermission(request, 'cars.edit');
  if (gate) return gate.response;
  const { id } = await params;
  try {
    const patched = await updateCarRoutePrice(id, await request.json());
    if (!patched) return NextResponse.json({ error: 'Price not found.' }, { status: 404 });
    return NextResponse.json({ price: patched });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request.' }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requirePermission(request, 'cars.delete');
  if (gate) return gate.response;
  const { id } = await params;
  try {
    const deleted = await deleteCarRoutePrice(id);
    if (!deleted) return NextResponse.json({ error: 'Price not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request.' }, { status: 400 });
  }
}
