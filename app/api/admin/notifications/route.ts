import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/server/notifications';

async function requireStaff(permission: string) {
  const current = await getCurrentUser();
  if (!current || !hasPermission(current, permission)) return null;
  return current;
}

/** Staff-only notification list (newest first) with the unread count. */
export async function GET() {
  const current = await requireStaff('support.view');
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const [notifications, unreadCount] = await Promise.all([
    listNotifications(current.id),
    countUnreadNotifications(current.id),
  ]);
  return NextResponse.json({ notifications, unreadCount });
}

/**
 * Staff owner-only read marking. No creation endpoint exists by design —
 * notifications are created server-side by real domain events only.
 * Both actions are idempotent: re-marking succeeds without writing.
 * Recipient ownership is enforced: a foreign notification id yields 404
 * without leaking its contents.
 */
export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await requireStaff('support.view');
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const action = (body as { action?: unknown })?.action;
  if (action === 'read-all') {
    await markAllNotificationsRead(current.id);
  } else if (action === 'read') {
    const id = (body as { id?: unknown })?.id;
    if (typeof id !== 'string' || id === '') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
    const owned = await markNotificationRead(current.id, id);
    if (!owned) return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
  } else {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const unreadCount = await countUnreadNotifications(current.id);
  return NextResponse.json({ ok: true, unreadCount });
}
