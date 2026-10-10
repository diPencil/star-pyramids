// P0 Fix 04 — guest booking access tokens.
//
// Pins the security contract: a booking reference must never be a
// credential, raw tokens are never persisted, and every failure mode is
// indistinguishable to the caller.
import { createHash, randomBytes } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hashToken } from '@/lib/core/tokens';

const REF = 'SP-BK-ABC123';

type TokenRow = {
  bookingRef: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

const created: TokenRow[] = [];
const lookups: string[] = [];
let bookRow: { reference: string; userId: string | null } | null = null;
let findUniqueThrows = false;

function installDb() {
  const delegate = {
    booking: {
      findUnique: vi.fn(async ({ where }: { where: { reference: string } }) => {
        if (!bookRow || bookRow.reference !== where.reference) return null;
        return bookRow;
      }),
    },
    bookingAccessToken: {
      create: vi.fn(async ({ data }: { data: Omit<TokenRow, 'revokedAt'> }) => {
        const row: TokenRow = { revokedAt: null, ...data };
        created.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
        lookups.push(where.tokenHash);
        if (findUniqueThrows) throw new Error('db down');
        return created.find((row) => row.tokenHash === where.tokenHash) ?? null;
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (module: any) => {
    module.booking = delegate.booking;
    module.bookingAccessToken = delegate.bookingAccessToken;
  };
}

async function loadService() {
  vi.resetModules();
  const dbModule = await import('@/lib/server/db');
  installDb()(dbModule.db as unknown as Record<string, unknown>);
  return import('@/lib/server/booking-access');
}

/** A token that satisfies the base64url(32 bytes) shape the service expects. */
function validToken(): string {
  return randomBytes(32).toString('base64url');
}

beforeEach(() => {
  created.length = 0;
  lookups.length = 0;
  bookRow = { reference: REF, userId: null };
  findUniqueThrows = false;
  delete process.env.BOOKING_ACCESS_TOKEN_TTL_DAYS;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('issueGuestBookingToken', () => {
  it('mints an unguessable token and stores only its hash', async () => {
    const { issueGuestBookingToken } = await loadService();
    const issued = await issueGuestBookingToken(REF);

    expect(issued).not.toBeNull();
    expect(issued!.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // 256 bits of entropy: the token must never be short or low-entropy.
    expect(randomBytes(32).toString('base64url')).not.toBe(issued!.token);

    expect(created).toHaveLength(1);
    // The raw token must appear NOWHERE in the persisted row.
    expect(created[0].tokenHash).toBe(hashToken(issued!.token));
    expect(created[0].tokenHash).not.toBe(issued!.token);
    expect(JSON.stringify(created[0])).not.toContain(issued!.token);
  });

  it('issues a distinct token every time', async () => {
    const { issueGuestBookingToken } = await loadService();
    const a = await issueGuestBookingToken(REF);
    const b = await issueGuestBookingToken(REF);
    expect(a!.token).not.toBe(b!.token);
    expect(created).toHaveLength(2);
  });

  it('sets an expiry from the TTL configuration', async () => {
    process.env.BOOKING_ACCESS_TOKEN_TTL_DAYS = '7';
    const { issueGuestBookingToken } = await loadService();
    await issueGuestBookingToken(REF);

    const days = (created[0].expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it('refuses to issue for a booking that belongs to an account', async () => {
    bookRow = { reference: REF, userId: 'user-1' };
    const { issueGuestBookingToken } = await loadService();

    // A second credential for an account-owned booking would only widen
    // the attack surface: customers already have the session flow.
    expect(await issueGuestBookingToken(REF)).toBeNull();
    expect(created).toHaveLength(0);
  });

  it('refuses for an unknown booking', async () => {
    bookRow = null;
    const { issueGuestBookingToken } = await loadService();
    expect(await issueGuestBookingToken(REF)).toBeNull();
    expect(created).toHaveLength(0);
  });
});

describe('resolveGuestBookingToken', () => {
  it('resolves a live token to its booking reference', async () => {
    const { issueGuestBookingToken, resolveGuestBookingToken } = await loadService();
    const issued = await issueGuestBookingToken(REF);

    await expect(resolveGuestBookingToken(issued!.token)).resolves.toEqual({ reference: REF });
  });

  it('looks the token up by SHA-256 hash, never by raw value', async () => {
    const { issueGuestBookingToken, resolveGuestBookingToken } = await loadService();
    const issued = await issueGuestBookingToken(REF);
    lookups.length = 0;

    await resolveGuestBookingToken(issued!.token);

    expect(lookups).toEqual([hashToken(issued!.token)]);
    expect(lookups).not.toContain(issued!.token);
    expect(lookups[0]).toBe(createHash('sha256').update(issued!.token, 'utf8').digest('hex'));
  });

  it('rejects an unknown token', async () => {
    const { resolveGuestBookingToken } = await loadService();
    await expect(resolveGuestBookingToken(validToken())).rejects.toThrow();
  });

  it('rejects a revoked token', async () => {
    const { issueGuestBookingToken, resolveGuestBookingToken } = await loadService();
    const issued = await issueGuestBookingToken(REF);
    created[0].revokedAt = new Date();

    await expect(resolveGuestBookingToken(issued!.token)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const { issueGuestBookingToken, resolveGuestBookingToken } = await loadService();
    const issued = await issueGuestBookingToken(REF);
    created[0].expiresAt = new Date(Date.now() - 1000);

    await expect(resolveGuestBookingToken(issued!.token)).rejects.toThrow();
  });

  it('gives an identical message for wrong, expired and revoked tokens', async () => {
    const { issueGuestBookingToken, resolveGuestBookingToken } = await loadService();

    const messageFor = async (mutate?: () => void) => {
      const issued = await issueGuestBookingToken(REF);
      mutate?.();
      await resolveGuestBookingToken(issued!.token).catch((error: Error) => error.message);
      return resolveGuestBookingToken(issued!.token).catch((error: Error) => error.message);
    };

    const wrong = await messageFor().then(() => resolveGuestBookingToken(validToken()).catch((e: Error) => e.message));
    const revoked = await (async () => {
      const issued = await issueGuestBookingToken(REF);
      const row = created[created.length - 1];
      row.revokedAt = new Date();
      return resolveGuestBookingToken(issued!.token).catch((e: Error) => e.message);
    })();
    const expired = await (async () => {
      const issued = await issueGuestBookingToken(REF);
      const row = created[created.length - 1];
      row.expiresAt = new Date(Date.now() - 1000);
      return resolveGuestBookingToken(issued!.token).catch((e: Error) => e.message);
    })();

    // A probe must not learn which failure it hit.
    expect(new Set([wrong, revoked, expired]).size).toBe(1);
  });

  it('rejects malformed tokens without touching the database', async () => {
    const { resolveGuestBookingToken } = await loadService();
    for (const bad of ['', 'short', 'x'.repeat(200), `${'a'.repeat(42)}+`, '../../etc/passwd']) {
      await expect(resolveGuestBookingToken(bad)).rejects.toThrow();
    }
    // Malformed input must not become a query.
    expect(lookups).toEqual([]);
  });

  it('does not deny a valid owner when the usage stamp fails', async () => {
    const { issueGuestBookingToken, resolveGuestBookingToken } = await loadService();
    const issued = await issueGuestBookingToken(REF);
    // A read-path bookkeeping failure must never break real access.
    const { db } = await import('@/lib/server/db');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).bookingAccessToken.updateMany = vi.fn().mockRejectedValue(new Error('write failed'));

    await expect(resolveGuestBookingToken(issued!.token)).resolves.toEqual({ reference: REF });
  });
});

describe('guestBookingPath', () => {
  it('carries the token in the path', async () => {
    const { guestBookingPath } = await loadService();
    const token = validToken();
    expect(guestBookingPath(token)).toBe(`/booking/${token}`);
    expect(guestBookingPath('a/b')).toBe(`/booking/a%2Fb`);
  });
});