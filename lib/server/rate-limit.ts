import 'server-only';

import { db } from './db';
import { normalizeEmail } from '../core/validation';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function checkLoginRateLimit(
  email: string,
  ipAddress: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const normalizedEmail = normalizeEmail(email);
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const recentFailures = await db.loginAttempt.count({
    where: {
      email: normalizedEmail,
      ipAddress,
      success: false,
      createdAt: { gte: windowStart },
    },
  });

  if (recentFailures >= MAX_ATTEMPTS) {
    const oldestFailure = await db.loginAttempt.findFirst({
      where: {
        email: normalizedEmail,
        ipAddress,
        success: false,
        createdAt: { gte: windowStart },
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    const retryAfterSeconds = oldestFailure
      ? Math.max(
          0,
          Math.ceil(
            (oldestFailure.createdAt.getTime() + WINDOW_MS - Date.now()) / 1000,
          ),
        )
      : 900;
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function recordLoginAttempt(
  email: string,
  ipAddress: string,
  success: boolean,
): Promise<void> {
  await db.loginAttempt.create({
    data: {
      email: normalizeEmail(email),
      ipAddress,
      success,
    },
  });
}

export async function clearLoginAttempts(
  email: string,
  ipAddress: string,
): Promise<void> {
  await db.loginAttempt.deleteMany({
    where: {
      email: normalizeEmail(email),
      ipAddress,
      success: false,
    },
  });
}
