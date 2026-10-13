import { NextResponse } from 'next/server';

import { buildBookingDocumentPdf, documentPdfResponse, publicBaseUrl } from '@/lib/server/document-pdf';
import { getAccountReadUser } from '@/lib/server/staff-preview';

// Private document bytes — evaluated per request, never cached.
export const dynamic = 'force-dynamic';

/**
 * Owner PDF download. The booking's registered customer can fetch a
 * PDF for a document of THIS booking (`ref` in the path must match the
 * document's booking). Unknown documents, other customers' documents
 * and mismatched references all return the same 404. Downloading never
 * issues a document.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ ref: string; documentId: string }> },
) {
  const current = await getAccountReadUser();
  if (!current) {
    return NextResponse.json(
      { error: 'Unauthorized.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  const { ref, documentId } = await ctx.params;
  const file = await buildBookingDocumentPdf(
    { kind: 'owner', userId: current.id },
    decodeURIComponent(documentId),
    decodeURIComponent(ref),
    { verificationBaseUrl: publicBaseUrl(request) },
  );
  return documentPdfResponse(file);
}
