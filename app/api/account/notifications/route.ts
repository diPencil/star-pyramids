import { isMarketingNotification } from '@/lib/marketing-notifications';
import { listMarketingNotifications, marketingForUser, markMarketingRead } from '@/lib/server/marketing-notifications';
import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/server/csrf';
import { getAccountReadUser, getAccountWriteUser } from '@/lib/server/staff-preview';
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/server/notifications';

/** Owner-only notification list (newest first) with the unread count. */
export async function GET() {
  const current = await getAccountReadUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const [personal, personalUnread, marketingResult] = await Promise.all([listNotifications(current.id), countUnreadNotifications(current.id),
      listMarketingNotifications().then(source => marketingForUser(current.id, source)).then(items => ({ items, unavailable: false })).catch(() => ({ items: [], unavailable: true })),
    ]);
    const marketing = marketingResult.items;
    const notifications = [...personal, ...marketing].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    return NextResponse.json({ notifications, unreadCount: personalUnread + marketing.filter(item => !item.readAt).length, marketingUnavailable: marketingResult.unavailable }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'Could not load notifications.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } }); }
}

/**
 * Owner-only read marking. No creation endpoint exists by design —
 * personal events retain their original behavior; active offers use owner-scoped read receipts.
 * Both actions are idempotent: re-marking succeeds without writing.
 */
export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await getAccountWriteUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  try {
  let marketingUnavailable = false;
  const action = (body as { action?: unknown })?.action;
  if (action === 'read-offers') {
    await markMarketingRead(current.id, await listMarketingNotifications());
  } else if (action === 'read-all') {
    await markAllNotificationsRead(current.id);
    try { await markMarketingRead(current.id, await listMarketingNotifications()); } catch { marketingUnavailable = true; }
  } else if (action === 'read') {
    const id = (body as { id?: unknown })?.id;
    if (typeof id !== 'string' || id === '') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
    const source = isMarketingNotification(id) ? await listMarketingNotifications() : [];
    const marketing = source.find(item => item.id === id);
    if (isMarketingNotification(id) && !marketing) return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
    if (marketing) await markMarketingRead(current.id, [marketing]);
    const owned = marketing || await markNotificationRead(current.id, id);
    if (!owned) return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
  } else {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const marketing = await listMarketingNotifications().then(source => marketingForUser(current.id, source)).catch(() => { marketingUnavailable = true; return [] });
  const unreadCount = await countUnreadNotifications(current.id) + marketing.filter(item => !item.readAt).length;
  return NextResponse.json({ ok: true, unreadCount, marketingUnavailable }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'Could not update notifications.' }, { status: 503 }); }
}
