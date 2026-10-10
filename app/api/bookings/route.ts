import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  checkBookingRateLimit,
  recordBookingAttempt,
} from '@/lib/server/rate-limit';
import {
  createBookingRecord,
  validateBookingDraft,
} from '@/lib/server/bookings';

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

function bodyEmail(body: unknown): string {
  if (typeof body !== 'object' || body === null) return 'unknown';
  const contact = (body as { contact?: unknown }).contact;
  if (typeof contact !== 'object' || contact === null) return 'unknown';
  const email = (contact as { email?: unknown }).email;
  return typeof email === 'string' && email ? email : 'unknown';
}

/**
 * Public checkout submission (cart -> booking).
 * Guest checkout is preserved: contact details identify the booking.
 * An authenticated CUSTOMER session links the record to that user —
 * ownership always comes from the server session, never the browser.
 * Pricing is recalculated server-side from the canonical catalogue;
 * any client-supplied price/total/status/payment field is rejected.
 * A repeated submission with the same idempotency key returns the
 * original booking instead of creating a duplicate.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const ip = clientIp(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const limit = await checkBookingRateLimit(bodyEmail(body), ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let draft;
  try {
    draft = await validateBookingDraft(body);
  } catch (error) {
    await recordBookingAttempt(bodyEmail(body), ip);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const current = await getCurrentUser();
  const userId =
    current && current.roles.includes('CUSTOMER') ? current.id : null;

  try {
    const { booking, created, guestAccessUrl } = await createBookingRecord(userId, draft);
    await recordBookingAttempt(draft.contactEmail, ip);
    // `guestAccessUrl` is the private link minted for a guest checkout; it
    // is null for account bookings, which keep their existing session flow.
    return NextResponse.json({ ...booking, guestAccessUrl }, { status: created ? 201 : 200 });
  } catch (error) {
    await recordBookingAttempt(draft.contactEmail, ip);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
