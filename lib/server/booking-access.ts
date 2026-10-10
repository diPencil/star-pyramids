// Guest booking access (P0 Fix 04).
//
// A booking reference (`SP-BK-…`) is a human-facing reference, not a
// credential. This service issues a SEPARATE opaque bearer token that a guest
// uses to read their own booking without an account.
//
// Contract:
// - 256 bits of CSPRNG entropy, base64url. Unguessable by construction.
// - Only the SHA-256 hash is persisted. A database leak cannot be replayed.
// - Bound to exactly one booking reference; a token never addresses a
//   different booking, and a reference alone never resolves a booking.
// - Expiring (fixed TTL) and revocable without touching the booking record.
// - Guest bookings only. Authenticated customers keep the existing
//   session-owned flow, which is unchanged.
import 'server-only';

import { db } from './db';
import { generateOpaqueToken, hashToken } from '../core/tokens';

/** Default lifetime: long enough for a real trip, short enough to bound risk. */
export const DEFAULT_ACCESS_TTL_DAYS = 90;

/** Failed-lookup budget per IP per window (brute-force signal). */
export const MAX_FAILED_LOOKUPS = 30;
export const FAILED_LOOKUP_WINDOW_MS = 60 * 60 * 1000;

/** base64url of 32 bytes. Anything else is rejected before any DB work. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type GuestBookingAccessFailure =
  | 'malformed'
  | 'unknown'
  | 'revoked'
  | 'expired'
  | 'not-found';

export class GuestBookingAccessError extends Error {
  constructor(
    readonly failure: GuestBookingAccessFailure,
    /**
     * Every failure MUST surface this identical message. Differing copy
     * ("expired" vs "revoked" vs "unknown") turns the endpoint into an
     * oracle: a prober could learn that a guessed token once existed.
     * `failure` is for server-side logging only and is never returned.
     */
    message: string = GUEST_ACCESS_DENIED,
  ) {
    super(message);
    this.name = 'GuestBookingAccessError';
  }
}

/** The single, uniform denial shown for every failed lookup. */
export const GUEST_ACCESS_DENIED = 'This booking link is not valid.';

function ttlMs(): number {
  const days = Number(process.env.BOOKING_ACCESS_TOKEN_TTL_DAYS);
  return (Number.isFinite(days) && days > 0 ? days : DEFAULT_ACCESS_TTL_DAYS) * 24 * 60 * 60 * 1000;
}

/** Public path a guest follows. The token is the only credential in it. */
export function guestBookingPath(token: string): string {
  return `/booking/${encodeURIComponent(token)}`;
}

/**
 * Mint a fresh access token for a guest booking. The raw token is returned
 * once and is never recoverable afterwards.
 *
 * Refuses to issue for a booking that belongs to an account: those are
 * reached through the authenticated customer flow, so a second credential
 * would only widen the attack surface.
 */
export async function issueGuestBookingToken(reference: string): Promise<{
  token: string;
  expiresAt: Date;
} | null> {
  const booking = await db.booking.findUnique({
    where: { reference },
    select: { reference: true, userId: true },
  });
  if (!booking || booking.userId) return null;

  const token = generateOpaqueToken(32);
  const expiresAt = new Date(Date.now() + ttlMs());
  await db.bookingAccessToken.create({
    data: { bookingRef: booking.reference, tokenHash: hashToken(token), expiresAt },
  });
  return { token, expiresAt };
}

/**
 * Resolve a raw token to its booking reference.
 *
 * Every failure mode raises the same `unknown` outcome to the caller so a
 * probe cannot distinguish "wrong token" from "expired" or "revoked".
 */
export async function resolveGuestBookingToken(rawToken: string): Promise<{
  reference: string;
}> {
  const token = rawToken.trim();
  if (!TOKEN_PATTERN.test(token)) {
    throw new GuestBookingAccessError('malformed');
  }

  const row = await db.bookingAccessToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { bookingRef: true, revokedAt: true, expiresAt: true },
  });
  if (!row) {
    throw new GuestBookingAccessError('unknown');
  }
  if (row.revokedAt) {
    throw new GuestBookingAccessError('revoked');
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new GuestBookingAccessError('expired');
  }

  // Best-effort usage stamp. A failure here must never deny a valid owner,
  // so it is deliberately not awaited into the success path.
  await db.bookingAccessToken
    .updateMany({ where: { tokenHash: hashToken(token) }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return { reference: row.bookingRef };
}

/** Revoke every guest token for a booking (e.g. once staff close it out). */
export async function revokeGuestBookingTokens(reference: string): Promise<void> {
  await db.bookingAccessToken.updateMany({
    where: { bookingRef: reference, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Per-IP brute-force budget. Only FAILED lookups are recorded, so this
 * counts guessing, not legitimate use.
 */
export async function checkGuestBookingAccessRateLimit(
  ipAddress: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const windowStart = new Date(Date.now() - FAILED_LOOKUP_WINDOW_MS);
  const failed = await db.bookingAccessAttempt.count({
    where: { ipAddress, createdAt: { gte: windowStart } },
  });
  if (failed < MAX_FAILED_LOOKUPS) return { allowed: true, retryAfterSeconds: 0 };
  const oldest = await db.bookingAccessAttempt.findFirst({
    where: { ipAddress, createdAt: { gte: windowStart } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  return {
    allowed: false,
    retryAfterSeconds: oldest
      ? Math.max(
          1,
          Math.ceil((oldest.createdAt.getTime() + FAILED_LOOKUP_WINDOW_MS - Date.now()) / 1000),
        )
      : Math.floor(FAILED_LOOKUP_WINDOW_MS / 1000),
  };
}

export async function recordGuestBookingAccessFailure(ipAddress: string): Promise<void> {
  await db.bookingAccessAttempt.create({
    data: { ipAddress: ipAddress.slice(0, 64) },
  });
  // Opportunistic pruning, same contract as the other attempt tables.
  void db.bookingAccessAttempt
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    .catch(() => undefined);
}