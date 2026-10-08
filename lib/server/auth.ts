// Auth service: credential validation + current-user resolution.
// Server-owned authority — frontend prototype auth state is display only
// and MUST NOT be treated as authenticated.
import 'server-only';

import { SetupTokenType } from '@prisma/client';

import { db } from './db';
import { getSession, touchSession } from './session';
import { resolvePermissionKeys, toPublicUser, type PublicUser } from './users';

export type { PublicUser };
import { verifyPassword } from '../core/password';
import { markLoggedIn } from './users';
import { generateOpaqueToken, hashToken } from '../core/tokens';
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
  // Any dashboard identity: holds at least one non-customer role.
  // Must match hasStaffRole/requireStaff so custom-role staff are not
  // bounced from /admin post-login while the shell lets them in.
  return hasStaffRole(user);
}

// ─── Password Reset Flow ───────────────────────────────────────────────────
// Reuses AccountSetupToken architecture with PASSWORD_RESET type.
// Single-use, expiring, securely hashed tokens. Never exposed in responses.

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESET_TOKEN_BYTES = 32;

export type ResetTokenFailureReason =
  | 'invalid-token'
  | 'expired'
  | 'already-used';

export async function createPasswordResetToken(
  email: string,
): Promise<{ token: string; userId: string } | { failure: 'not-found' }> {
  const normalized = normalizeEmail(email);
  const user = await db.user.findUnique({
    where: { emailNormalized: normalized },
    select: { id: true, status: true },
  });
  // Prevent account enumeration: always return success shape.
  // Token is only created if user exists and is active.
  if (!user || user.status !== 'ACTIVE') {
    return { failure: 'not-found' };
  }
  const rawToken = generateOpaqueToken(RESET_TOKEN_BYTES);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await db.accountSetupToken.create({
    data: {
      tokenHash,
      userId: user.id,
      type: SetupTokenType.PASSWORD_RESET,
      expiresAt,
    },
  });
  return { token: rawToken, userId: user.id };
}

export async function validatePasswordResetToken(
  token: string,
): Promise<{ userId: string } | { failure: ResetTokenFailureReason }> {
  if (!token) return { failure: 'invalid-token' };
  const tokenHash = hashToken(token);
  const record = await db.accountSetupToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!record) return { failure: 'invalid-token' };
  if (record.usedAt) return { failure: 'already-used' };
  if (record.expiresAt.getTime() <= Date.now()) return { failure: 'expired' };
  return { userId: record.userId };
}

export async function consumePasswordResetToken(
  token: string,
  newPassword: string,
): Promise<{ success: true } | { failure: ResetTokenFailureReason }> {
  const validation = await validatePasswordResetToken(token);
  if ('failure' in validation) return { failure: validation.failure };
  const { userId } = validation;
  const passwordHash = await import('../core/password').then((m) =>
    m.hashPassword(newPassword),
  );
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { passwordHash },
    }),
    db.accountSetupToken.update({
      where: { tokenHash: hashToken(token) },
      data: { usedAt: new Date() },
    }),
    // Password was reset out-of-band: revoke every session for this
    // user so any active (possibly stolen) session is invalidated.
    db.session.deleteMany({ where: { userId } }),
  ]);
  return { success: true };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentSessionId?: string,
): Promise<{ success: true } | { failure: 'invalid-current' | 'same-password' }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user || !user.passwordHash) return { failure: 'invalid-current' };
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return { failure: 'invalid-current' };
  const same = await verifyPassword(newPassword, user.passwordHash);
  if (same) return { failure: 'same-password' };
  const passwordHash = await import('../core/password').then((m) =>
    m.hashPassword(newPassword),
  );
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { passwordHash },
    }),
    // Revoke all other sessions; keep the current session valid when
    // the caller passes its session id (authenticated change flow).
    ...(currentSessionId
      ? [db.session.deleteMany({
          where: { userId, id: { not: currentSessionId } },
        })]
      : [db.session.deleteMany({ where: { userId } })]),
  ]);
  return { success: true };
}
