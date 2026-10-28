import { rentCarFailure } from '@/lib/server/rent-car-errors';
// Staff-only route management (Phase 2). Directional identity means A→B and
// B→A are separate rows; duplicates are rejected with a friendly conflict.
import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/server/csrf';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { createCarRoute, listAllCarRoutesAdmin } from '@/lib/server/car-pricing';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(user, 'cars.edit')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  void request;
  const rows = await listAllCarRoutesAdmin();
  return NextResponse.json({ routes: rows });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(user, 'cars.create')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const originOk = isSameOriginRequest(request);
  if (!originOk) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });

  try {
    const data = await request.json();
    const created = await createCarRoute(data);
    return NextResponse.json({ route: created }, { status: 201 });
  } catch (error) {
    const failure = rentCarFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
