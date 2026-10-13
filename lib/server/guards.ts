import 'server-only';

import { redirect } from 'next/navigation';

import { getCurrentUser, hasStaffRole, type PublicUser } from './auth';
import { getStaffPreviewCustomer } from './staff-preview';

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

export async function requireCustomerOrStaffPreview(nextPath = '/account'): Promise<{ user: PublicUser; isStaffPreview: boolean }> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  const preview = await getStaffPreviewCustomer(user);
  if (preview) return { user: preview, isStaffPreview: true };
  if (!user.roles.includes('CUSTOMER')) {
    redirect(hasStaffRole(user) ? '/admin' : '/login');
  }
  return { user, isStaffPreview: false };
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
