import { NextResponse } from 'next/server';
import { db } from '@/lib/server/db';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { enquirySelect, enquiryStaffWhere } from '@/lib/server/enquiries';
import type { EnquiryStatus } from '@prisma/client';

type Context = { params: Promise<{ publicId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(user, 'enquiries.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const { publicId } = await params;
  if (!publicId || publicId.length > 64) return NextResponse.json({ error: 'Invalid enquiry ID.' }, { status: 400 });
  try {
    const enquiry = await db.websiteEnquiry.findUnique({ where: { publicId }, select: enquirySelect });
    if (!enquiry) return NextResponse.json({ error: 'Enquiry not found.' }, { status: 404 });
    return NextResponse.json({ enquiry });
  } catch {
    return NextResponse.json({ error: 'Could not load enquiry.' }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(user, 'enquiries.manage')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const { publicId } = await params;
  if (!publicId || publicId.length > 64) return NextResponse.json({ error: 'Invalid enquiry ID.' }, { status: 400 });
  let body: Record<string, unknown>;
  try {
    const input: unknown = await request.json();
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error();
    body = input as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const { status, assignedToId, internalNotes, expectedUpdatedAt } = body;
  if (status !== undefined && (typeof status !== 'string' || !['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status))) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }
  if (assignedToId !== undefined && assignedToId !== null && (typeof assignedToId !== 'string' || assignedToId.length > 64)) {
    return NextResponse.json({ error: 'Invalid staff reference.' }, { status: 400 });
  }
  if (internalNotes !== undefined && internalNotes !== null && (typeof internalNotes !== 'string' || internalNotes.length > 10000)) {
    return NextResponse.json({ error: 'Internal notes must be 10000 characters or fewer.' }, { status: 400 });
  }
  if (expectedUpdatedAt !== undefined && (typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt)))) {
    return NextResponse.json({ error: 'Invalid enquiry version.' }, { status: 400 });
  }
  if (status === undefined && assignedToId === undefined && internalNotes === undefined) {
    return NextResponse.json({ error: 'No changes supplied.' }, { status: 400 });
  }
  try {
    const existing = await db.websiteEnquiry.findUnique({ where: { publicId }, select: { id: true, assignedTo: { select: { publicId: true } } } });
    if (!existing) return NextResponse.json({ error: 'Enquiry not found.' }, { status: 404 });
    let assignUserId: string | null | undefined;
    if (assignedToId !== undefined && assignedToId !== existing.assignedTo?.publicId) {
      if (assignedToId === null || assignedToId === '') assignUserId = null;
      else {
        const assignee = await db.user.findFirst({ where: { ...enquiryStaffWhere, publicId: assignedToId as string }, select: { id: true } });
        if (!assignee) return NextResponse.json({ error: 'Choose an active staff member authorized to manage enquiries.' }, { status: 400 });
        assignUserId = assignee.id;
      }
    }
    const result = await db.$transaction(async (tx) => {
      const changed = await tx.websiteEnquiry.updateMany({
        where: { publicId, ...(expectedUpdatedAt ? { updatedAt: new Date(expectedUpdatedAt as string) } : {}) },
        data: {
          ...(status !== undefined ? { status: status as EnquiryStatus } : {}),
          ...(assignUserId !== undefined ? { assignedToId: assignUserId } : {}),
          ...(internalNotes !== undefined ? { internalNotes: typeof internalNotes === 'string' ? internalNotes.trim() || null : null } : {}),
        },
      });
      if (!changed.count) return null;
      return tx.websiteEnquiry.findUnique({ where: { publicId }, select: enquirySelect });
    });
    if (!result) return NextResponse.json({ error: 'This enquiry changed since you opened it. Reload its details before saving.' }, { status: 409 });
    return NextResponse.json({ enquiry: result });
  } catch {
    return NextResponse.json({ error: 'Could not save enquiry changes. Please reload to check before retrying.' }, { status: 503 });
  }
}
