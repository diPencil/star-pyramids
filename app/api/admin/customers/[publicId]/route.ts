import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { getCustomerDetail, setCustomerStatus } from '@/lib/server/customers';
import { UserManagementError } from '@/lib/server/users';

function toError(error: unknown) {
  if (error instanceof UserManagementError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'Could not complete the request.' }, { status: 500 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'customers.view')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const { publicId } = await params;
  if (!publicId) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  try {
    const customer = await getCustomerDetail(publicId);
    return NextResponse.json({
      customer,
      viewer: { publicId: user.publicId, roles: user.roles, permissions: user.permissions },
    });
  } catch (error) {
    return toError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'customers.edit')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const { publicId } = await params;
  if (!publicId) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const status = (body as { status?: unknown })?.status;
  if (status !== 'ACTIVE' && status !== 'SUSPENDED') {
    return NextResponse.json({ error: 'Select a valid status.' }, { status: 400 });
  }

  try {
    const customer = await setCustomerStatus(
      publicId,
      status,
      { id: user.id, publicId: user.publicId, roles: user.roles, permissions: user.permissions },
    );
    return NextResponse.json({ customer });
  } catch (error) {
    return toError(error);
  }
}
