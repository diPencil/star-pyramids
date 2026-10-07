import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { logSupportError, sendStaffMessage } from '@/lib/server/support-chat';

async function requireStaff() {
  const current = await getCurrentUser();
  if (!current || !hasPermission(current, 'support.edit')) return null;
  return current;
}

interface RouteContext {
  params: Promise<{ ref: string }>;
}

/**
 * Staff reply on the thread's message collection:
 * POST /api/admin/conversations/<ref>/messages. The inbox composer
 * addresses replies by this sub-path, but only the thread-level route
 * existed, so every reply fell through to the framework's HTML 404
 * before any handler ran. Guards and rules are identical to the
 * thread-level POST (same-origin, staff session, body-only payload,
 * OPEN threads only) — both URLs resolve to one send path. Failures
 * log the exact reason server-side; message bodies are never logged.
 */
export async function POST(request: Request, context: RouteContext) {
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
  try {
    const result = await sendStaffMessage(
      reference,
      current.id,
      (body as { body?: unknown })?.body,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === 'Conversation not found.' ? 404 : 400;
      logSupportError('staff-reply', reference, error);
      return NextResponse.json({ error: error.message }, { status });
    }
    logSupportError('staff-reply', reference, error);
    return NextResponse.json({ error: 'Could not send the reply. Please try again.' }, { status: 500 });
  }
}
