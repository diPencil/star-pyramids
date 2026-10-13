import { NextResponse } from 'next/server';

import { db } from '@/lib/server/db';
import { listBookingDocuments, toDocumentListItem } from '@/lib/server/documents';
import { getAccountReadUser } from '@/lib/server/staff-preview';

/**
 * Owner-only document list for one booking (Phase C).
 *
 * Same ownership rule as the booking detail and the owner PDF download:
 * the booking's registered customer, matched by session user id. Any
 * other caller — including a signed-in user who does not own this
 * booking — gets the uniform 404. Read-only; customers never issue.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ ref: string }> },
) {
  const current = await getAccountReadUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const reference = decodeURIComponent((await ctx.params).ref);
  const booking = await db.booking.findUnique({
    where: { reference },
    select: { id: true, userId: true },
  });
  if (!booking || booking.userId !== current.id) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }
  const documents = await listBookingDocuments(booking.id);
  return NextResponse.json({ documents: documents.map(toDocumentListItem) });
}
