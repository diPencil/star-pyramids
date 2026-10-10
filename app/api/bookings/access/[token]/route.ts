import { NextResponse } from 'next/server';

import {
  GUEST_ACCESS_DENIED,
  GuestBookingAccessError,
  checkGuestBookingAccessRateLimit,
  recordGuestBookingAccessFailure,
} from '@/lib/server/booking-access';
import { getGuestBooking } from '@/lib/server/bookings';

// Always evaluated per request: this route is a token lookup, never cached.
export const dynamic = 'force-dynamic';

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Guest booking access (P0 Fix 04).
 *
 * GET with a private access token in the path. There is NO reference-based
 * variant of this endpoint on purpose: a booking reference must never be
 * sufficient to read a booking, so this is the only route through which an
 * unlinked (guest) booking can be read.
 *
 * - Read-only. A leaked link can never cancel, pay, or otherwise mutate.
 * - Every failure returns the same 404 body, so a probe cannot tell a wrong
 *   token from an expired or revoked one.
 * - Failed lookups are counted per IP; the token's 256-bit entropy is the
 *   primary control and this is defence in depth.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const ip = clientIp(request);

  const limit = await checkGuestBookingAccessRateLimit(ip).catch(() => ({
    allowed: true,
    retryAfterSeconds: 0,
  }));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const token = decodeURIComponent((await ctx.params).token);

  try {
    const booking = await getGuestBooking(token);
    return NextResponse.json(booking, {
      // Never let a shared cache hold personal booking data.
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof GuestBookingAccessError) {
      await recordGuestBookingAccessFailure(ip).catch(() => undefined);
      return NextResponse.json(
        { error: error.message },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    console.error('Guest booking access failed:', error);
    return NextResponse.json(
      { error: GUEST_ACCESS_DENIED },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}