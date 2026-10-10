import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  createRole,
  listPermissionCatalog,
  listRolesDetailed,
  SUPER_ADMIN_ONLY_PERMISSIONS,
  UserManagementError,
} from '@/lib/server/users';

function toError(error: unknown) {
  if (error instanceof UserManagementError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'Could not complete the request.' }, { status: 500 });
}

export async function GET() {
  // Any staff member holding roles.view may read roles + matrix (same
  // visibility as the static matrix it replaces); mutations below are
  // SUPER_ADMIN-exclusive (enforced in the service boundary).
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'roles.view')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  try {
    const [roles, catalog] = await Promise.all([
      listRolesDetailed(),
      listPermissionCatalog(),
    ]);
    return NextResponse.json({
      roles,
      catalog,
      // Policy overlay for the matrix: raw `roles[].permissions` stay
      // truthful DB state, while these keys render as locked (never
      // granted) on every non-SUPER_ADMIN role, matching API enforcement.
      restrictedPermissions: [...SUPER_ADMIN_ONLY_PERMISSIONS],
      viewer: {
        roles: user.roles,
        canManageRoles: user.roles.includes('SUPER_ADMIN'),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Could not load roles.' }, { status: 500 });
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

  try {
    const role = await createRole(
      {
        name: typeof data.name === 'string' ? data.name : '',
        description: typeof data.description === 'string' ? data.description : undefined,
      },
      { id: user.id, publicId: user.publicId, roles: user.roles, permissions: user.permissions },
    );
    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    return toError(error);
  }
}
