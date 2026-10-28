import { rentCarFailure } from '@/lib/server/rent-car-errors';
// Staff-only location edit/delete (Phase 2). Slugs are immutable
// (FK targets for routes); DELETE is blocked by the service when routes
// still reference the location.
import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/server/csrf';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { deleteCarLocation, updateCarLocation } from '@/lib/server/car-pricing';

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
  { params }: { params: Promise<{ slug: string }> },
) {
  const gate = await requirePermission(request, 'cars.edit');
  if (gate) return gate.response;
  const { slug } = await params;
  try {
    const patched = await updateCarLocation(slug, await request.json());
    if (!patched) return NextResponse.json({ error: 'Location not found.' }, { status: 404 });
    return NextResponse.json({ location: patched });
  } catch (error) {
    const failure = rentCarFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const gate = await requirePermission(request, 'cars.delete');
  if (gate) return gate.response;
  const { slug } = await params;
  try {
    const deleted = await deleteCarLocation(slug);
    if (!deleted) return NextResponse.json({ error: 'Location not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const failure = rentCarFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
