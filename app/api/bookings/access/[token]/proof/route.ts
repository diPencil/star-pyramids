import { NextResponse } from 'next/server';

import {
  GUEST_ACCESS_DENIED,
  GuestBookingAccessError,
  checkGuestBookingAccessRateLimit,
  recordGuestBookingAccessFailure,
} from '@/lib/server/booking-access';
import {
  ProofRateLimitError,
  submitGuestPaymentProof,
  validateProofInput,
} from '@/lib/server/payment-proofs';

// Always evaluated per request: this route is a token lookup, never cached.
export const dynamic = 'force-dynamic';

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Guest payment-proof submission, authorized ONLY by the private access
 * token (same bearer trust as the read-only guest endpoint).
 *
 * Reference-only: appends one harmless activity row for staff review.
 * A leaked link can never move money, change status, or upload files —
 * the submission never creates or settles a Payment row. Every token
 * failure returns the same 404 body as the read endpoint, and failed
 * lookups count against the same per-IP brute-force budget.
 */
export async function POST(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  try {
    const proof = validateProofInput(body);
    const submitted = await submitGuestPaymentProof(token, proof);
    return NextResponse.json(
      { proof: submitted },
      {
        status: submitted.created ? 201 : 200,
        // Never let a shared cache hold personal booking data.
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    if (error instanceof GuestBookingAccessError) {
      await recordGuestBookingAccessFailure(ip).catch(() => undefined);
      return NextResponse.json(
        { error: error.message },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (error instanceof ProofRateLimitError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: {
            'Retry-After': String(error.retryAfterSeconds),
            'Cache-Control': 'no-store',
          },
        },
      );
    }
    if (error instanceof Error) {
      // Validation/state problems carry safe messages only. Token
      // problems never reach here (uniform 404 above); anything else
      // unexpected stays a generic failure without a token oracle.
      const accessLike =
        error.message === GUEST_ACCESS_DENIED ||
        error.message === 'This booking link is not valid.';
      if (accessLike) {
        await recordGuestBookingAccessFailure(ip).catch(() => undefined);
        return NextResponse.json(
          { error: error.message },
          { status: 404, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Guest payment-proof submission failed:', error);
    return NextResponse.json(
      { error: GUEST_ACCESS_DENIED },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
