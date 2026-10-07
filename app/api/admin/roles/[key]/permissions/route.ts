import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { setRolePermissions, UserManagementError } from '@/lib/server/users';

function toError(error: unknown) {
  if (error instanceof UserManagementError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'Could not complete the request.' }, { status: 500 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const { key } = await params;
  if (!key) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const data = (body ?? {}) as Record<string, unknown>;
  const permissions = Array.isArray(data.permissions)
    ? data.permissions.filter((p): p is string => typeof p === 'string')
    : undefined;
  if (!permissions) {
    return NextResponse.json({ error: 'Select a valid permission set.' }, { status: 400 });
  }

  try {
    const role = await setRolePermissions(
      key,
      permissions,
      { id: user.id, publicId: user.publicId, roles: user.roles, permissions: user.permissions },
    );
    return NextResponse.json({ role });
  } catch (error) {
    return toError(error);
  }
}
