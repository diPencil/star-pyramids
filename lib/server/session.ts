// Server-owned opaque session management.
// - Sessions live in MySQL (`sessions` table); the browser only holds an
//   opaque token in an HttpOnly cookie. No auth tokens in localStorage.
// - Cookie: HttpOnly, SameSite=Lax, Secure in production, Path=/,
//   30-day rolling expiry (refreshed on activity via lastSeenAt).
// - Logout deletes the row (immediate invalidation). Expiry is enforced
//   on every read; a janitor may delete expired rows opportunistically.
import 'server-only';

import { cookies } from 'next/headers';

import { db } from './db';
import { generateOpaqueToken, hashToken } from '../core/tokens';

export const SESSION_COOKIE_NAME = 'sp_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: Date;
}

export async function createSession(
  userId: string,
  meta?: { ipAddress?: string; userAgent?: string },
): Promise<{ token: string; record: SessionRecord }> {
  const token = generateOpaqueToken();
  const record = await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ipAddress: meta?.ipAddress?.slice(0, 64),
      userAgent: meta?.userAgent?.slice(0, 255),
    },
    select: { id: true, userId: true, expiresAt: true },
  });
  const jar = await cookies();
  jar.set(
    SESSION_COOKIE_NAME,
    token,
    sessionCookieOptions(Math.floor(SESSION_TTL_MS / 1000)),
  );
  return { token, record };
}

export async function getSession(): Promise<SessionRecord | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const row = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: row.id } }).catch(() => undefined);
    return null;
  }
  return row;
}

export async function touchSession(id: string): Promise<void> {
  await db.session
    .update({
      where: { id },
      data: {
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    })
    .catch(() => undefined);
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await db.session
      .delete({ where: { tokenHash: hashToken(token) } })
      .catch(() => undefined);
  }
  jar.set(SESSION_COOKIE_NAME, '', {
    ...sessionCookieOptions(0),
    maxAge: 0,
  });
}

export async function destroyAllUserSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
