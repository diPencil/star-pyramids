import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { updateStaffUser, UserManagementError } from '@/lib/server/users';

function toError(error: unknown) {
  if (error instanceof UserManagementError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'Could not complete the request.' }, { status: 500 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
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
  const data = (body ?? {}) as Record<string, unknown>;

  const roleRaw = data.roleKey ?? data.role;
  let roleKey: Parameters<typeof updateStaffUser>[1]['roleKey'] = undefined;
  if (roleRaw !== undefined) {
    if (typeof roleRaw !== 'string' || !roleRaw) {
      return NextResponse.json({ error: 'Select a valid staff role.' }, { status: 400 });
    }
    roleKey = roleRaw;
  }
  const statusRaw = data.status;
  if (statusRaw !== undefined && statusRaw !== 'ACTIVE' && statusRaw !== 'SUSPENDED') {
    return NextResponse.json({ error: 'Select a valid status.' }, { status: 400 });
  }

  try {
    const updated = await updateStaffUser(
      publicId,
      {
        firstName:
          typeof data.firstName === 'string' || data.firstName === null
            ? (data.firstName as string | null)
            : undefined,
        lastName:
          typeof data.lastName === 'string' || data.lastName === null
            ? (data.lastName as string | null)
            : undefined,
        email: typeof data.email === 'string' ? data.email : undefined,
        roleKey,
        status: statusRaw as 'ACTIVE' | 'SUSPENDED' | undefined,
      },
      { id: user.id, publicId: user.publicId, roles: user.roles, permissions: user.permissions },
    );
    const name =
      [updated.firstName, updated.lastName].filter(Boolean).join(' ') ||
      updated.email.split('@')[0]!;
    return NextResponse.json({
      user: {
        publicId: updated.publicId,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        displayName: name,
        status: updated.status,
        roles: updated.roles,
        online: updated.online,
        lastLoginAt: updated.lastLoginAt,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    return toError(error);
  }
}
