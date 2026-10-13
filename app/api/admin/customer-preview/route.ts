import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission, hasStaffRole } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { beginStaffPreview, clearStaffPreview } from '@/lib/server/staff-preview';
import { toClientUser } from '@/lib/server/users';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const staff = await getCurrentUser();
  if (!staff) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasStaffRole(staff) || !hasPermission(staff, 'customers.view')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const publicId = (body as { publicId?: unknown })?.publicId;
  if (typeof publicId !== 'string' || !publicId || publicId.length > 128) {
    return NextResponse.json({ error: 'Invalid customer.' }, { status: 400 });
  }

  const customer = await beginStaffPreview(staff, publicId);
  if (!customer) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  return NextResponse.json({ customer: toClientUser(customer), readOnly: true });
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  await clearStaffPreview();
  return NextResponse.json({ ok: true });
}
