import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { listCustomers } from '@/lib/server/customers';

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
