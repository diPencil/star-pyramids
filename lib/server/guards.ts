import 'server-only';

import { redirect } from 'next/navigation';

import { getCurrentUser, hasStaffRole, type PublicUser } from './auth';

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

export async function requireCustomer(nextPath = '/account'): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (!user.roles.includes('CUSTOMER')) {
    redirect(hasStaffRole(user) ? '/admin' : '/login');
  }
  return user;
}

export async function requireStaff(): Promise<PublicUser> {
  const user = await requireUser();
  // Any non-customer role may reach the dashboard shell (custom
  // configurable roles included); CUSTOMER-only accounts go to /account.
  if (!hasStaffRole(user)) {
    redirect(user.roles.includes('CUSTOMER') ? '/account' : '/login');
  }
  return user;
}

export async function requireRole(roleKey: string): Promise<PublicUser> {
  const user = await requireUser();
  if (!user.roles.includes(roleKey)) {
    redirect('/login');
  }
  return user;
}
