import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  grantableRoleKeys,
  inviteStaffUser,
  listRolesDetailed,
  listStaffUsers,
  UserManagementError,
  type StaffListItem,
} from '@/lib/server/users';

function toDirectoryItem(user: StaffListItem) {
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.email.split('@')[0]!;
  return {
    publicId: user.publicId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: name,
    status: user.status,
    roles: user.roles,
    online: user.online,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

function toError(error: unknown) {
  if (error instanceof UserManagementError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'Could not complete the request.' }, { status: 500 });
}

export async function GET() {
  // Staff-only directory. Any dashboard role holding users.view may read;
  // mutations below are SUPER_ADMIN-exclusive (enforced in the service
  // boundary, regardless of legacy users.manage grants).
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'users.view')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  try {
    const users = await listStaffUsers();
    const allRoles = await listRolesDetailed();
    return NextResponse.json({
      users: users.map(toDirectoryItem),
      viewer: { publicId: user.publicId, roles: user.roles, permissions: user.permissions },
      grantableRoles: grantableRoleKeys(
        { id: user.id, publicId: user.publicId, roles: user.roles, permissions: user.permissions },
        allRoles,
      ),
    });
  } catch {
    return NextResponse.json({ error: 'Could not load team members.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const data = (body ?? {}) as Record<string, unknown>;
  const roleKey = typeof data.roleKey === 'string' ? data.roleKey : data.role;
  if (typeof roleKey !== 'string' || !roleKey) {
    return NextResponse.json({ error: 'Select a valid staff role.' }, { status: 400 });
  }

  try {
    const created = await inviteStaffUser(
      {
        email: typeof data.email === 'string' ? data.email : '',
        password: typeof data.password === 'string' ? data.password : '',
        firstName: typeof data.firstName === 'string' ? data.firstName : undefined,
        lastName: typeof data.lastName === 'string' ? data.lastName : undefined,
        roleKey,
      },
      { id: user.id, publicId: user.publicId, roles: user.roles, permissions: user.permissions },
    );
    return NextResponse.json({ user: toDirectoryItem(created) }, { status: 201 });
  } catch (error) {
    return toError(error);
  }
}
