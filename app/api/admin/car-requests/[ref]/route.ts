import { rentCarFailure } from '@/lib/server/rent-car-errors';
import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import {
  addStaffCarNote,
  assignStaffCarVehicle,
  getStaffCarRequest,
  transitionStaffCarRequest,
} from '@/lib/server/car-requests';
import { CAR_REQUEST_STATUSES, isCarReference, type CarRequestStatus } from '@/lib/car-request';

type StaffPatchBody = {
  status?: unknown;
  note?: unknown;
  internal?: unknown;
  assignedVehicle?: unknown;
};

/** Staff request detail (full projection incl. internal notes). */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ ref: string }> },
) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'requests.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const reference = (await ctx.params).ref;
  if (!isCarReference(reference)) return NextResponse.json({ error: 'Car request not found.' }, { status: 404 });
  const item = await getStaffCarRequest(reference);
  if (!item) return NextResponse.json({ error: 'Car request not found.' }, { status: 404 });
  return NextResponse.json(item);
}

/**
 * Staff mutation: lifecycle transition (validated against the shared
 * transition map), fleet-vehicle assignment, and/or a staff-only internal
 * note. Browser ownership fields are never read — the reference comes from
 * the route and the actor from the session.
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
  const reference = (await ctx.params).ref;
  if (!isCarReference(reference)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  let body: StaffPatchBody;
  try {
    body = (await request.json()) as StaffPatchBody;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['status', 'note', 'internal', 'assignedVehicle'].includes(key))) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    if (body.internal !== undefined && typeof body.internal !== 'boolean') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    if (body.assignedVehicle !== undefined && (body.status !== undefined || body.note !== undefined)) return NextResponse.json({ error: 'Send assignment and status/note changes separately.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const note = typeof body.note === 'string' ? body.note.trim() : '';
  const internal = body.internal !== false;

  const audit = (action: string, metadata?: Record<string, unknown>) =>
    db.staffActionAudit
      .create({
        data: {
          actorId: current.id,
          action,
          entityType: 'car_request',
          entityId: reference,
          ...(metadata ? { metadata: JSON.stringify(metadata) } : {}),
        },
      })
      .catch(() => undefined);

  try {
    if (typeof body.assignedVehicle === 'string' && typeof body.status !== 'string') {
      const item = await assignStaffCarVehicle(reference, body.assignedVehicle);
      if (!item) return NextResponse.json({ error: 'Car request not found.' }, { status: 404 });
      await audit('car-request.assign', { assignedVehicle: body.assignedVehicle.trim() });
      return NextResponse.json(item);
    }
    if (typeof body.status === 'string') {
      const to = body.status as CarRequestStatus;
      if (!(CAR_REQUEST_STATUSES as readonly string[]).includes(to)) {
        return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
      }
      const item = await transitionStaffCarRequest(reference, to, note, internal);
      if (!item) return NextResponse.json({ error: 'Car request not found.' }, { status: 404 });
      await audit('car-request.transition', { to, hasNote: note !== '' });
      return NextResponse.json(item);
    }
    if (note !== '') {
      const item = await addStaffCarNote(reference, note);
      if (!item) return NextResponse.json({ error: 'Car request not found.' }, { status: 404 });
      await audit('car-request.note');
      return NextResponse.json(item);
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  } catch (error) {
    if (error instanceof Error) {
      const failure = rentCarFailure(error);
      return NextResponse.json({ error: failure.error }, { status: failure.status });
    }
    throw error;
  }
}
