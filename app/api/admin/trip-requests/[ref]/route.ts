import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import {
  addStaffTripNote,
  getStaffTripRequest,
  transitionStaffTripRequest,
} from '@/lib/server/trip-requests';
import type { TripRequestStatus } from '@/lib/trip-request';

const STATUSES: TripRequestStatus[] = [
  'new',
  'reviewing',
  'proposal_ready',
  'approved',
  'rejected',
  'cancelled',
];

type StaffPatchBody = {
  status?: unknown;
  note?: unknown;
  internal?: unknown;
};

/** Staff request detail (full projection incl. internal notes). */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ ref: string }> },
) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'requests.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const reference = decodeURIComponent((await ctx.params).ref);
  const item = await getStaffTripRequest(reference);
  if (!item) return NextResponse.json({ error: 'Trip request not found.' }, { status: 404 });
  return NextResponse.json(item);
}

/**
 * Staff mutation: lifecycle transition (validated against the shared
 * transition map) and/or a staff-only internal note. Browser ownership
 * fields are never read — the reference comes from the route and the actor
 * from the session.
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
  if (!hasPermission(current, 'requests.edit')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const reference = decodeURIComponent((await ctx.params).ref);

  let body: StaffPatchBody;
  try {
    body = (await request.json()) as StaffPatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
  const internal = body.internal !== false;

  try {
    if (typeof body.status === 'string') {
      const to = body.status as TripRequestStatus;
      if (!STATUSES.includes(to)) {
        return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
      }
      const item = await transitionStaffTripRequest(reference, to, note, internal);
      if (!item) return NextResponse.json({ error: 'Trip request not found.' }, { status: 404 });
      await db.staffActionAudit
        .create({
          data: {
            actorId: current.id,
            action: 'trip-request.transition',
            entityType: 'trip_request',
            entityId: reference,
            metadata: JSON.stringify({ to, hasNote: note !== '' }),
          },
        })
        .catch(() => undefined);
      return NextResponse.json(item);
    }
    if (note !== '') {
      const item = await addStaffTripNote(reference, note);
      if (!item) return NextResponse.json({ error: 'Trip request not found.' }, { status: 404 });
      await db.staffActionAudit
        .create({
          data: {
            actorId: current.id,
            action: 'trip-request.note',
            entityType: 'trip_request',
            entityId: reference,
          },
        })
        .catch(() => undefined);
      return NextResponse.json(item);
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
