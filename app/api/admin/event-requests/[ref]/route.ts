import { NextResponse } from 'next/server';

import { getCurrentUser, isStaff } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import {
  addStaffEventNote,
  getStaffEventRequest,
  transitionStaffEventRequest,
} from '@/lib/server/event-requests';
import { EVENT_REQUEST_STATUSES, type EventRequestStatus } from '@/lib/event-request';

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
  if (!isStaff(current)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const reference = decodeURIComponent((await ctx.params).ref);
  const item = await getStaffEventRequest(reference);
  if (!item) return NextResponse.json({ error: 'Event request not found.' }, { status: 404 });
  return NextResponse.json(item);
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
  if (!isStaff(current)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
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
          entityType: 'event_request',
          entityId: reference,
          ...(metadata ? { metadata: JSON.stringify(metadata) } : {}),
        },
      })
      .catch(() => undefined);

  try {
    if (typeof body.status === 'string') {
      const to = body.status as EventRequestStatus;
      if (!(EVENT_REQUEST_STATUSES as readonly string[]).includes(to)) {
        return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
      }
      const item = await transitionStaffEventRequest(reference, to, note, internal);
      if (!item) return NextResponse.json({ error: 'Event request not found.' }, { status: 404 });
      await audit('event-request.transition', { to, hasNote: note !== '' });
      return NextResponse.json(item);
    }
    if (note !== '') {
      const item = await addStaffEventNote(reference, note);
      if (!item) return NextResponse.json({ error: 'Event request not found.' }, { status: 404 });
      await audit('event-request.note');
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
