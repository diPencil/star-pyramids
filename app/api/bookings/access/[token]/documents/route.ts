import { NextResponse } from 'next/server';

import {
  GuestBookingAccessError,
  checkGuestBookingAccessRateLimit,
  recordGuestBookingAccessFailure,
  resolveGuestBookingToken,
} from '@/lib/server/booking-access';
import { db } from '@/lib/server/db';
import { listBookingDocuments, toDocumentListItem } from '@/lib/server/documents';

// Always evaluated per request: this route resolves a token, never cached.
export const dynamic = 'force-dynamic';

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Guest document list for the token's own booking (Phase C).
 *
 * Read-only companion to the guest booking view and the token-protected
 * PDF download. The payload carries document metadata only — ids,
 * numbers, types, amounts, issue dates — and NEVER the token itself:
 * the client already holds the token and builds each PDF link from it.
 * Every token failure returns the same uniform 404 as the booking view.
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
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSeconds), 'Cache-Control': 'no-store' },
      },
    );
  }

  const token = decodeURIComponent((await ctx.params).token);

  try {
    const { reference } = await resolveGuestBookingToken(token);
    const booking = await db.booking.findUnique({
      where: { reference },
      select: { id: true },
    });
    if (!booking) throw new GuestBookingAccessError('not-found');
    const documents = await listBookingDocuments(booking.id);
    return NextResponse.json(
      { documents: documents.map(toDocumentListItem) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof GuestBookingAccessError) {
      await recordGuestBookingAccessFailure(ip).catch(() => undefined);
      return NextResponse.json(
        { error: error.message },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    console.error('Guest document list failed:', error);
    return NextResponse.json(
      { error: 'This booking link is not valid.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
