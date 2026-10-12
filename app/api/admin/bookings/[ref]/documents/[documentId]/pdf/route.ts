import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { buildBookingDocumentPdf, documentPdfResponse, publicBaseUrl } from '@/lib/server/document-pdf';

// Private document bytes — evaluated per request, never cached.
export const dynamic = 'force-dynamic';

/**
 * Staff PDF download for identities holding `bookings.view` or
 * `payments.view` (the same audiences as the Phase-A access gate).
 * The `ref` in the path must match the document's booking, so a valid
 * document id cannot be replayed under another booking's address.
 * Downloading never issues a document.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ ref: string; documentId: string }> },
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json(
      { error: 'Unauthorized.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  if (!hasPermission(current, 'bookings.view') && !hasPermission(current, 'payments.view')) {
    return NextResponse.json(
      { error: 'Forbidden.' },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  const { ref, documentId } = await ctx.params;
  const file = await buildBookingDocumentPdf(
    { kind: 'staff', user: current },
    decodeURIComponent(documentId),
    decodeURIComponent(ref),
    { verificationBaseUrl: publicBaseUrl(request) },
  );
  return documentPdfResponse(file);
}
