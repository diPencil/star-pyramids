import { NextResponse } from 'next/server';

import {
  GUEST_ACCESS_DENIED,
  GuestBookingAccessError,
  checkGuestBookingAccessRateLimit,
  resolveGuestBookingToken,
  recordGuestBookingAccessFailure,
} from '@/lib/server/booking-access';
import { buildBookingDocumentPdf, documentPdfResponse, publicBaseUrl } from '@/lib/server/document-pdf';

// Private document bytes — evaluated per request, never cached.
export const dynamic = 'force-dynamic';

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Guest PDF download through the opaque booking-access token (the same
 * credential that guards the guest booking view). The token stays in
 * the path — never a query string — and is bound by the Phase-A gate
 * to THIS booking: a token for another booking gets the same 404 as a
 * wrong or expired token. Failed lookups share the guest-access rate
 * limit; downloading never issues a document.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ token: string; documentId: string }> },
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
        headers: {
          'Retry-After': String(limit.retryAfterSeconds),
          'Cache-Control': 'private, no-store',
        },
      },
    );
  }

  const { token, documentId } = await ctx.params;
  try {
    // Resolves (or refuses) the token first so a bad token cannot be
    // told apart from a bad document id.
    await resolveGuestBookingToken(decodeURIComponent(token));
  } catch (error) {
    if (error instanceof GuestBookingAccessError) {
      await recordGuestBookingAccessFailure(ip).catch(() => undefined);
      return NextResponse.json(
        { error: GUEST_ACCESS_DENIED },
        { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }
    console.error('Guest document access failed:', error);
    return NextResponse.json(
      { error: GUEST_ACCESS_DENIED },
      { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const file = await buildBookingDocumentPdf(
    { kind: 'guest', rawToken: decodeURIComponent(token) },
    decodeURIComponent(documentId),
    null,
    { verificationBaseUrl: publicBaseUrl(request) },
  );
  return documentPdfResponse(file);
}
