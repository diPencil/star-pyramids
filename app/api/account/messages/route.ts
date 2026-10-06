import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  countCustomerUnread,
  getCustomerThread,
  listCustomerThreadReferences,
  markCustomerThreadRead,
  sendCustomerMessage,
} from '@/lib/server/support-chat';
import {
  customerSupportHref,
  LEGACY_CUSTOMER_SUPPORT_HREF,
  markNotificationsReadByHref,
} from '@/lib/server/notifications';

async function requireCustomer() {
  const current = await getCurrentUser();
  if (!current) return null;
  if (!current.roles.includes('CUSTOMER')) return null;
  return current;
}

/**
 * Owner-only support thread (latest conversation with chronological
 * messages) plus the unread staff-message count. Returns a null
 * conversation when the customer never wrote — the welcome state.
 */
export async function GET() {
  const current = await requireCustomer();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const thread = await getCustomerThread(current.id);
  return NextResponse.json(thread);
}

/**
 * Owner-only send + read marking. Send appends to the latest OPEN
 * thread or opens a fresh one when none is open (closed threads stay
 * read-only history). Sender identity always comes from the server
 * session — the body carries text (and an optional subject) only.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await requireCustomer();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const text = (body as { body?: unknown })?.body;
  const subject = (body as { subject?: unknown })?.subject;
  try {
    const result = await sendCustomerMessage(current.id, text, subject);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

/** Owner-only read marking for incoming staff messages. Idempotent. */
export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await requireCustomer();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if ((body as { action?: unknown })?.action !== 'read') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  await markCustomerThreadRead(current.id);
  // Read-sync: the matching support notifications (exact conversation
  // hrefs plus the legacy generic href) resolve alongside the messages.
  // Best-effort — a sync failure must never break reading.
  try {
    const refs = await listCustomerThreadReferences(current.id);
    await markNotificationsReadByHref(current.id, 'support_message_received', [
      ...refs.map(customerSupportHref),
      LEGACY_CUSTOMER_SUPPORT_HREF,
    ]);
  } catch {
    /* read-sync never breaks the read */
  }
  const unreadCount = await countCustomerUnread(current.id);
  return NextResponse.json({ ok: true, unreadCount });
}
