import 'server-only';

import { db } from './db';
import { normalizeEmail } from '../core/validation';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REGISTRATION_ATTEMPTS = 3;
const REGISTRATION_WINDOW_MS = 60 * 60 * 1000;
const MAX_TRIP_REQUEST_ATTEMPTS = 10;
const TRIP_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const MAX_CAR_REQUEST_ATTEMPTS = 10;
const CAR_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const MAX_EVENT_REQUEST_ATTEMPTS = 10;
const EVENT_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const MAX_BOOKING_ATTEMPTS = 10;
const BOOKING_WINDOW_MS = 60 * 60 * 1000;
const MAX_PAYMENT_ATTEMPTS = 10;
const PAYMENT_WINDOW_MS = 60 * 60 * 1000;
const MAX_PASSWORD_RESET_ATTEMPTS = 5;
const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;

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

export async function checkRegistrationRateLimit(
  email: string,
  ipAddress: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const normalizedEmail = normalizeEmail(email).slice(0, 190);
  const windowStart = new Date(Date.now() - REGISTRATION_WINDOW_MS);
  const selector = {
    createdAt: { gte: windowStart },
    OR: [{ email: normalizedEmail }, { ipAddress }],
  };
  const recentAttempts = await db.registrationAttempt.count({ where: selector });
  if (recentAttempts < MAX_REGISTRATION_ATTEMPTS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const oldest = await db.registrationAttempt.findFirst({
    where: selector,
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  return {
    allowed: false,
    retryAfterSeconds: oldest
      ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + REGISTRATION_WINDOW_MS - Date.now()) / 1000))
      : Math.floor(REGISTRATION_WINDOW_MS / 1000),
  };
}

export async function recordRegistrationAttempt(
  email: string,
  ipAddress: string,
): Promise<void> {
  await db.registrationAttempt.create({
    data: {
      email: normalizeEmail(email).slice(0, 190),
      ipAddress: ipAddress.slice(0, 64),
    },
  });
  void db.registrationAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  }).catch(() => undefined);
}

/**
 * Abuse protection for the public trip-request endpoint. Guests and
 * customers share one generous budget (10 submissions/hour per email or
 * IP) so legitimate retries and travel-party duplicates are never harmed.
 */
export async function checkTripRequestRateLimit(
  email: string,
  ipAddress: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const normalizedEmail = normalizeEmail(email).slice(0, 190);
  const windowStart = new Date(Date.now() - TRIP_REQUEST_WINDOW_MS);
  const selector = {
    createdAt: { gte: windowStart },
    OR: [{ email: normalizedEmail }, { ipAddress }],
  };
  const recentAttempts = await db.tripRequestAttempt.count({ where: selector });
  if (recentAttempts < MAX_TRIP_REQUEST_ATTEMPTS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const oldest = await db.tripRequestAttempt.findFirst({
    where: selector,
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  return {
    allowed: false,
    retryAfterSeconds: oldest
      ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + TRIP_REQUEST_WINDOW_MS - Date.now()) / 1000))
      : Math.floor(TRIP_REQUEST_WINDOW_MS / 1000),
  };
}

export async function recordTripRequestAttempt(
  email: string,
  ipAddress: string,
): Promise<void> {
  await db.tripRequestAttempt.create({
    data: {
      email: normalizeEmail(email).slice(0, 190),
      ipAddress: ipAddress.slice(0, 64),
    },
  });
  void db.tripRequestAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  }).catch(() => undefined);
}

/**
 * Abuse protection for the public car-request endpoint. Guests and
 * customers share one generous budget (10 submissions/hour per email or
 * IP) so legitimate retries and travel-party duplicates are never harmed.
 */
export async function checkCarRequestRateLimit(
  email: string,
  ipAddress: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const normalizedEmail = normalizeEmail(email).slice(0, 190);
  const windowStart = new Date(Date.now() - CAR_REQUEST_WINDOW_MS);
  const selector = {
    createdAt: { gte: windowStart },
    OR: [{ email: normalizedEmail }, { ipAddress }],
  };
  const recentAttempts = await db.carRequestAttempt.count({ where: selector });
  if (recentAttempts < MAX_CAR_REQUEST_ATTEMPTS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const oldest = await db.carRequestAttempt.findFirst({
    where: selector,
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  return {
    allowed: false,
    retryAfterSeconds: oldest
      ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + CAR_REQUEST_WINDOW_MS - Date.now()) / 1000))
      : Math.floor(CAR_REQUEST_WINDOW_MS / 1000),
  };
}

export async function recordCarRequestAttempt(
  email: string,
  ipAddress: string,
): Promise<void> {
  await db.carRequestAttempt.create({
    data: {
      email: normalizeEmail(email).slice(0, 190),
      ipAddress: ipAddress.slice(0, 64),
    },
  });
  void db.carRequestAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  }).catch(() => undefined);
}

/**
 * Abuse protection for the public event-request endpoint. Guests and
 * customers share one generous budget (10 submissions/hour per email or
 * IP) so legitimate retries are never harmed.
 */
export async function checkEventRequestRateLimit(
  email: string,
  ipAddress: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const normalizedEmail = normalizeEmail(email).slice(0, 190);
  const windowStart = new Date(Date.now() - EVENT_REQUEST_WINDOW_MS);
  const selector = {
    createdAt: { gte: windowStart },
    OR: [{ email: normalizedEmail }, { ipAddress }],
  };
  const recentAttempts = await db.eventRequestAttempt.count({ where: selector });
  if (recentAttempts < MAX_EVENT_REQUEST_ATTEMPTS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const oldest = await db.eventRequestAttempt.findFirst({
    where: selector,
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  return {
    allowed: false,
    retryAfterSeconds: oldest
      ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + EVENT_REQUEST_WINDOW_MS - Date.now()) / 1000))
      : Math.floor(EVENT_REQUEST_WINDOW_MS / 1000),
  };
}

export async function recordEventRequestAttempt(
  email: string,
  ipAddress: string,
): Promise<void> {
  await db.eventRequestAttempt.create({
    data: {
      email: normalizeEmail(email).slice(0, 190),
      ipAddress: ipAddress.slice(0, 64),
    },
  });
  void db.eventRequestAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  }).catch(() => undefined);
}

/**
 * Abuse protection for the public checkout endpoint. Guests and
 * customers share one generous budget (10 submissions/hour per email or
 * IP) so legitimate retries are never harmed.
 */
export async function checkBookingRateLimit(
  email: string,
  ipAddress: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const normalizedEmail = normalizeEmail(email).slice(0, 190);
  const windowStart = new Date(Date.now() - BOOKING_WINDOW_MS);
  const selector = {
    createdAt: { gte: windowStart },
    OR: [{ email: normalizedEmail }, { ipAddress }],
  };
  const recentAttempts = await db.bookingAttempt.count({ where: selector });
  if (recentAttempts < MAX_BOOKING_ATTEMPTS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const oldest = await db.bookingAttempt.findFirst({
    where: selector,
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  return {
    allowed: false,
    retryAfterSeconds: oldest
      ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + BOOKING_WINDOW_MS - Date.now()) / 1000))
      : Math.floor(BOOKING_WINDOW_MS / 1000),
  };
}

export async function recordBookingAttempt(
  email: string,
  ipAddress: string,
): Promise<void> {
  await db.bookingAttempt.create({
    data: {
      email: normalizeEmail(email).slice(0, 190),
      ipAddress: ipAddress.slice(0, 64),
    },
  });
  void db.bookingAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  }).catch(() => undefined);
}

/**
 * Abuse protection for the payment-initiation endpoint. Customers
 * share one generous budget (10 initiations/hour per email or IP) so
 * legitimate retries are never harmed; duplicates are absorbed by
 * idempotent initiation, not by rejection.
 */
export async function checkPaymentRateLimit(
  email: string,
  ipAddress: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const normalizedEmail = normalizeEmail(email).slice(0, 190);
  const windowStart = new Date(Date.now() - PAYMENT_WINDOW_MS);
  const selector = {
    createdAt: { gte: windowStart },
    OR: [{ email: normalizedEmail }, { ipAddress }],
  };
  const recentAttempts = await db.paymentAttempt.count({ where: selector });
  if (recentAttempts < MAX_PAYMENT_ATTEMPTS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const oldest = await db.paymentAttempt.findFirst({
    where: selector,
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  return {
    allowed: false,
    retryAfterSeconds: oldest
      ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + PAYMENT_WINDOW_MS - Date.now()) / 1000))
      : Math.floor(PAYMENT_WINDOW_MS / 1000),
  };
}

export async function recordPaymentAttempt(
  email: string,
  ipAddress: string,
): Promise<void> {
  await db.paymentAttempt.create({
    data: {
      email: normalizeEmail(email).slice(0, 190),
      ipAddress: ipAddress.slice(0, 64),
    },
  });
  void db.paymentAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  }).catch(() => undefined);
}

/**
 * Abuse protection for the password reset endpoints (forgot/reset).
 * Both endpoints share one budget (5 attempts/hour per email or IP)
 * to prevent enumeration and spam.
 */
export async function checkPasswordResetRateLimit(
  email: string,
  ipAddress: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const normalizedEmail = normalizeEmail(email).slice(0, 190);
  const windowStart = new Date(Date.now() - PASSWORD_RESET_WINDOW_MS);
  const selector = {
    createdAt: { gte: windowStart },
    OR: [{ email: normalizedEmail }, { ipAddress }],
  };
  const recentAttempts = await db.passwordResetAttempt.count({ where: selector });
  if (recentAttempts < MAX_PASSWORD_RESET_ATTEMPTS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const oldest = await db.passwordResetAttempt.findFirst({
    where: selector,
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  return {
    allowed: false,
    retryAfterSeconds: oldest
      ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + PASSWORD_RESET_WINDOW_MS - Date.now()) / 1000))
      : Math.floor(PASSWORD_RESET_WINDOW_MS / 1000),
  };
}

export async function recordPasswordResetAttempt(
  email: string,
  ipAddress: string,
): Promise<void> {
  await db.passwordResetAttempt.create({
    data: {
      email: normalizeEmail(email).slice(0, 190),
      ipAddress: ipAddress.slice(0, 64),
    },
  });
  void db.passwordResetAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  }).catch(() => undefined);
}

/**
 * IP-only abuse protection for the reset-password endpoint.
 * The bearer reset token is the secret here, so per-IP limiting
 * (no email bucket) is the appropriate granularity: it throttles
 * token-guessing without coupling unrelated customers' budgets.
 */
export async function checkResetSubmitRateLimit(
  ipAddress: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const windowStart = new Date(Date.now() - PASSWORD_RESET_WINDOW_MS);
  const selector = {
    createdAt: { gte: windowStart },
    ipAddress,
  };
  const recentAttempts = await db.passwordResetAttempt.count({ where: selector });
  if (recentAttempts < MAX_PASSWORD_RESET_ATTEMPTS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const oldest = await db.passwordResetAttempt.findFirst({
    where: selector,
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  return {
    allowed: false,
    retryAfterSeconds: oldest
      ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + PASSWORD_RESET_WINDOW_MS - Date.now()) / 1000))
      : Math.floor(PASSWORD_RESET_WINDOW_MS / 1000),
  };
}
