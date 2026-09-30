// Auth service: credential validation + current-user resolution.
// Server-owned authority — frontend prototype auth state is display only
// and MUST NOT be treated as authenticated.
import 'server-only';

import { db } from './db';
import { getSession, touchSession } from './session';
import { toPublicUser, type PublicUser } from './users';

export type { PublicUser };
import { verifyPassword } from '../core/password';
import { markLoggedIn } from './users';
import { isValidEmail, normalizeEmail } from '../core/validation';

export type LoginFailureReason =
  | 'invalid-credentials'
  | 'suspended'
  | 'pending';

export async function validateCredentials(
  email: string,
  password: string,
): Promise<{ user: PublicUser } | { failure: LoginFailureReason }> {
  if (!isValidEmail(email) || !password) {
    return { failure: 'invalid-credentials' };
  }
  const row = await db.user.findUnique({
    where: { emailNormalized: normalizeEmail(email) },
    select: {
      id: true,
      publicId: true,
      email: true,
      status: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      passwordHash: true,
      roles: { select: { role: { select: { key: true } } } },
    },
  });
  if (!row || !row.passwordHash) return { failure: 'invalid-credentials' };
  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) return { failure: 'invalid-credentials' };
  if (row.status === 'SUSPENDED') return { failure: 'suspended' };
  if (row.status === 'PENDING') return { failure: 'pending' };
  const { passwordHash: _dropped, ...rest } = row;
  await markLoggedIn(row.id);
  return { user: toPublicUser(rest) };
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const session = await getSession();
  if (!session) return null;
  const row = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      publicId: true,
      email: true,
      status: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      roles: { select: { role: { select: { key: true } } } },
    },
  });
  if (!row || row.status !== 'ACTIVE') return null;
  await touchSession(session.id);
  return toPublicUser(row);
}

export function hasRole(user: PublicUser, roleKey: string): boolean {
  return user.roles.includes(roleKey);
}

export function isStaff(user: PublicUser): boolean {
  return (
    hasRole(user, 'SUPER_ADMIN') ||
    hasRole(user, 'ADMIN') ||
    hasRole(user, 'STAFF')
  );
}
