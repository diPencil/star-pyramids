import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  createRole,
  listPermissionCatalog,
  listRolesDetailed,
  UserManagementError,
} from '@/lib/server/users';

function toError(error: unknown) {
  if (error instanceof UserManagementError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'Could not complete the request.' }, { status: 500 });
}

export async function GET() {
  // Any staff member may read roles + matrix (same visibility as the
  // static matrix it replaces); mutations below require roles.manage.
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
      viewer: {
        roles: user.roles,
        canManageRoles: hasPermission(user, 'roles.manage'),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Could not load roles.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
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
