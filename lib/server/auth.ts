// Auth service: credential validation + current-user resolution.
// Server-owned authority — frontend prototype auth state is display only
// and MUST NOT be treated as authenticated.
import 'server-only';

import { db } from './db';
import { getSession, touchSession } from './session';
import { resolvePermissionKeys, toPublicUser, type PublicUser } from './users';

export type { PublicUser };
import { verifyPassword } from '../core/password';
import { markLoggedIn } from './users';
import {
  isValidEmail,
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
} from '../core/validation';

export type LoginFailureReason =
  | 'invalid-credentials'
  | 'suspended'
  | 'pending';

export async function validateCredentials(
  identifier: string,
  password: string,
): Promise<{ user: PublicUser } | { failure: LoginFailureReason }> {
  const trimmed = identifier.trim();
  if (!trimmed || !password) {
    return { failure: 'invalid-credentials' };
  }
  // One shared flow: email uses existing email normalization, username uses
  // the exact registration normalization (trim + lowercase). Anything else
  // yields the same generic failure without revealing account existence.
  const where = isValidEmail(trimmed)
    ? { emailNormalized: normalizeEmail(trimmed) }
    : isValidUsername(trimmed)
      ? { username: normalizeUsername(trimmed) }
      : null;
  if (!where) {
    return { failure: 'invalid-credentials' };
  }
  const row = await db.user.findUnique({
    where,
    select: {
      id: true,
      publicId: true,
      email: true,
      firstName: true,
      lastName: true,
      username: true,
      countryCode: true,
      phone: true,
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
  return { user: toPublicUser(rest, await resolvePermissionKeys(row.id)) };
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
      firstName: true,
      lastName: true,
      username: true,
      countryCode: true,
      phone: true,
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
  return toPublicUser(row, await resolvePermissionKeys(row.id));
}

export function hasRole(user: PublicUser, roleKey: string): boolean {
  return user.roles.includes(roleKey);
}

/** Any dashboard identity: holds at least one non-customer role. */
export function hasStaffRole(user: Pick<PublicUser, 'roles'>): boolean {
  return user.roles.some((key) => key !== 'CUSTOMER');
}

/**
 * Permission check for admin APIs. SUPER_ADMIN bypasses (full access by
 * definition); everyone else needs the explicit grant. Matrix edits take
 * effect on the next request with no code changes.
 */
export function hasPermission(
  user: Pick<PublicUser, 'roles' | 'permissions'>,
  key: string,
): boolean {
  if (user.roles.includes('SUPER_ADMIN')) return true;
  return user.permissions.includes(key);
}

export function isStaff(user: PublicUser): boolean {
  return (
    hasRole(user, 'SUPER_ADMIN') ||
    hasRole(user, 'ADMIN') ||
    hasRole(user, 'STAFF')
  );
}
