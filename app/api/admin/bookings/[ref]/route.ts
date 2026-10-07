import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import {
  addStaffBookingNote,
  getStaffBooking,
  transitionStaffBooking,
} from '@/lib/server/bookings';
import { BOOKING_STATUSES, type BookingStatus } from '@/lib/booking';

type StaffPatchBody = {
  status?: unknown;
  note?: unknown;
  internal?: unknown;
};

/** Staff booking detail (full projection incl. internal notes). */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ ref: string }> },
) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'bookings.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const reference = decodeURIComponent((await ctx.params).ref);
  const booking = await getStaffBooking(reference);
  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  return NextResponse.json(booking);
}

/**
 * Staff mutation: lifecycle transition (validated against the shared
 * transition map) and/or a staff-only internal note. Browser ownership
 * fields are never read — the reference comes from the route and the
 * actor from the session.
 */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ ref: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'bookings.edit')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const reference = decodeURIComponent((await ctx.params).ref);

  let body: StaffPatchBody;
  try {
    body = (await request.json()) as StaffPatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
  const internal = body.internal !== false;

  const audit = (action: string, metadata?: Record<string, unknown>) =>
    db.staffActionAudit
      .create({
        data: {
          actorId: current.id,
          action,
          entityType: 'booking',
          entityId: reference,
          ...(metadata ? { metadata: JSON.stringify(metadata) } : {}),
        },
      })
      .catch(() => undefined);

  try {
    if (typeof body.status === 'string') {
      const to = body.status as BookingStatus;
      if (!(BOOKING_STATUSES as readonly string[]).includes(to)) {
        return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
      }
      const booking = await transitionStaffBooking(reference, to, note, internal);
      if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      await audit('booking.transition', { to, hasNote: note !== '' });
      return NextResponse.json(booking);
    }
    if (note !== '') {
      const booking = await addStaffBookingNote(reference, note);
      if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      await audit('booking.note');
      return NextResponse.json(booking);
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
