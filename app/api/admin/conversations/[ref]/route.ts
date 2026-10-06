import { NextResponse } from 'next/server';

import { getCurrentUser, isStaff } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  assignConversationToSelf,
  getStaffConversation,
  logSupportError,
  markStaffThreadRead,
  sendStaffMessage,
  setConversationStatus,
} from '@/lib/server/support-chat';
import { adminSupportHref, markNotificationsReadByHref } from '@/lib/server/notifications';

/**
 * Read-sync helper: after a staff user opens/reads a thread, resolve
 * that user's unread notifications for exactly this conversation.
 * Best-effort — never breaks the read.
 */
async function syncStaffNotificationsRead(userId: string, reference: string): Promise<void> {
  try {
    await markNotificationsReadByHref(userId, 'admin_support_message_received', [
      adminSupportHref(reference),
    ]);
  } catch {
    /* read-sync never breaks the read */
  }
}

async function requireStaff() {
  const current = await getCurrentUser();
  if (!current || !isStaff(current)) return null;
  return current;
}

interface RouteContext {
  params: Promise<{ ref: string }>;
}

/**
 * Staff-only thread detail with chronological history. Viewing marks
 * the thread's incoming customer messages read (opening = reading),
 * matching the inbox UX. Foreign/missing references yield 404 without
 * leaking contents.
 */
export async function GET(_request: Request, context: RouteContext) {
  const current = await requireStaff();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const { ref } = await context.params;
  const thread = await getStaffConversation(decodeURIComponent(ref));
  if (!thread) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  await markStaffThreadRead(thread.conversation.reference);
  await syncStaffNotificationsRead(current.id, thread.conversation.reference);
  const refreshed = await getStaffConversation(thread.conversation.reference);
  return NextResponse.json(refreshed ?? thread);
}

/**
 * Staff-only reply. OPEN threads only — replying to a closed thread is
 * rejected (reopen it first). Sender identity comes from the server
 * session; the body carries text only.
 */
export async function POST(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await requireStaff();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const { ref } = await context.params;

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  try {
    const result = await sendStaffMessage(
      decodeURIComponent(ref),
      current.id,
      (body as { body?: unknown })?.body,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === 'Conversation not found.' ? 404 : 400;
      // Log both branches so a 404 states its exact reason server-side
      // instead of arriving at the client as an unexplained status.
      logSupportError('staff-reply', decodeURIComponent(ref), error);
      return NextResponse.json({ error: error.message }, { status });
    }
    logSupportError('staff-reply', decodeURIComponent(ref), error);
    return NextResponse.json({ error: 'Could not send the reply. Please try again.' }, { status: 500 });
  }
}

/**
 * Staff-only thread actions: read (idempotent), close, reopen, and
 * assign-to-me (identity is server-derived; arbitrary staff IDs are
 * never accepted from the browser).
 */
export async function PATCH(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await requireStaff();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const { ref } = await context.params;
  const reference = decodeURIComponent(ref);

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const action = (body as { action?: unknown })?.action;
  try {
    if (action === 'read') {
      await markStaffThreadRead(reference);
      await syncStaffNotificationsRead(current.id, reference);
    } else if (action === 'close' || action === 'reopen') {
      const updated = await setConversationStatus(reference, action === 'close' ? 'closed' : 'open');
      if (!updated) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
      return NextResponse.json({ ok: true, conversation: updated });
    } else if (action === 'assign') {
      const updated = await assignConversationToSelf(reference, current.id);
      if (!updated) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
      return NextResponse.json({ ok: true, conversation: updated });
    } else {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true });
}
