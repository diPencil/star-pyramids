import 'server-only';

import { redirect } from 'next/navigation';

import { getCurrentUser, isStaff, type PublicUser } from './auth';

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

export async function requireStaff(): Promise<PublicUser> {
  const user = await requireUser();
  if (!isStaff(user)) {
    redirect('/login');
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
