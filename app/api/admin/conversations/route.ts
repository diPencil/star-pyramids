import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { countStaffUnread, listStaffConversations } from '@/lib/server/support-chat';

async function requireStaff(permission: string) {
  const current = await getCurrentUser();
  if (!current || !hasPermission(current, permission)) return null;
  return current;
}

/**
 * Staff-only support inbox: cross-customer threads newest-first with
 * per-thread unread counts, plus the global unread customer-message
 * total. Optional ?status=open|closed&query= filters.
 */
export async function GET(request: Request) {
  const current = await requireStaff('support.view');
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const status =
    statusParam === 'open' || statusParam === 'closed' ? statusParam : undefined;
  const query = url.searchParams.get('query') ?? undefined;
  const [conversations, unreadCount] = await Promise.all([
    listStaffConversations({ ...(status ? { status } : {}), ...(query ? { query } : {}) }),
    countStaffUnread(),
  ]);
  return NextResponse.json({ conversations, unreadCount });
}
