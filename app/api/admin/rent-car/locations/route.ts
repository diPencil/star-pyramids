// Staff-only rent-car location management (Phase 2). RBAC reuses the fleet
// catalogue permissions (read via cars.edit; writes split across
// cars.create/cars.edit/cars.delete) + same-origin CSRF, so no
// pricing/catalog mutation is publicly reachable.
import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/server/csrf';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { createCarLocation, listAllCarLocationsAdmin } from '@/lib/server/car-pricing';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(user, 'cars.edit')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  void request;
  const rows = await listAllCarLocationsAdmin();
  return NextResponse.json({ locations: rows });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(user, 'cars.create')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const originOk = isSameOriginRequest(request);
  if (!originOk) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });

  const data = await request.json();
  try {
    const created = await createCarLocation(data);
    return NextResponse.json({ location: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request.' }, { status: 400 });
  }
}
