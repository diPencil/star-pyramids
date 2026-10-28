import { rentCarFailure } from '@/lib/server/rent-car-errors';
// Staff-only vehicle/route price management (Phase 2). These mutations are
// never publicly exposed: read requires cars.edit and writes split across
// cars.create/cars.edit/cars.delete, with same-origin CSRF on every mutation.
import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/server/csrf';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { createCarRoutePrice, listAllCarPricesAdmin } from '@/lib/server/car-pricing';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(user, 'cars.edit')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const url = new URL(request.url);
  const routeId = url.searchParams.get('routeId') ?? undefined;
  const carSlug = url.searchParams.get('carSlug') ?? undefined;
  const rows = await listAllCarPricesAdmin({
    ...(routeId ? { routeId } : {}),
    ...(carSlug ? { carSlug } : {}),
  });
  return NextResponse.json({ prices: rows });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(user, 'cars.create')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const originOk = isSameOriginRequest(request);
  if (!originOk) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });

  try {
    const data = await request.json();
    const created = await createCarRoutePrice(data);
    return NextResponse.json({ price: created }, { status: 201 });
  } catch (error) {
    const failure = rentCarFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
