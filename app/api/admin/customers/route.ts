import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { createCustomer, listCustomers } from '@/lib/server/customers';
import { UserManagementError } from '@/lib/server/users';

function toError(error: unknown) {
  if (error instanceof UserManagementError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'Could not complete the request.' }, { status: 500 });
}

export async function GET() {
  // Staff directory read for the CRM. Any holder of customers.view
  // (all operational roles by backfill); mutations require customers.edit.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'customers.view')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  try {
    const customers = await listCustomers();
    return NextResponse.json({
      customers,
      viewer: { publicId: user.publicId, roles: user.roles, permissions: user.permissions },
    });
  } catch {
    return NextResponse.json({ error: 'Could not load customers.' }, { status: 500 });
  }
}

/**
 * Create a real customer account from the CRM.
 *
 * Requires customers.edit (not merely view). The password is hashed server
 * side and is never echoed back. The CUSTOMER role is assigned server side;
 * a staff account can never be created through this endpoint.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'customers.edit')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  const password = text(body.password);
  const confirmPassword = text(body.confirmPassword);
  if (password !== confirmPassword) {
    return NextResponse.json({ error: 'The passwords do not match.' }, { status: 400 });
  }

  try {
    const customer = await createCustomer(
      {
        email: text(body.email),
        password,
        firstName: text(body.firstName),
        lastName: text(body.lastName),
        username: text(body.username),
        countryCode: text(body.countryCode),
        phone: text(body.phone),
      },
      { id: user.id, publicId: user.publicId, roles: user.roles, permissions: user.permissions },
    );
    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    return toError(error);
  }
}
