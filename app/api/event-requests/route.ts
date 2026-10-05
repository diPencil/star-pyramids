import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  checkEventRequestRateLimit,
  recordEventRequestAttempt,
} from '@/lib/server/rate-limit';
import {
  createEventRequestRecord,
  validateEventDraft,
} from '@/lib/server/event-requests';

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

function bodyEmail(body: unknown): string {
  if (typeof body !== 'object' || body === null) return 'unknown';
  const email = (body as { email?: unknown }).email;
  return typeof email === 'string' && email ? email : 'unknown';
}

/**
 * Public event-request submission (event detail pages).
 * Guest submissions are preserved: contact details identify the request.
 * An authenticated CUSTOMER session links the record to that user —
 * ownership always comes from the server session, never the browser.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const ip = clientIp(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const limit = await checkEventRequestRateLimit(bodyEmail(body), ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let draft;
  try {
    draft = validateEventDraft(body);
  } catch (error) {
    await recordEventRequestAttempt(bodyEmail(body), ip);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const current = await getCurrentUser();
  const userId =
    current && current.roles.includes('CUSTOMER') ? current.id : null;

  try {
    const created = await createEventRequestRecord(userId, draft);
    await recordEventRequestAttempt(draft.contactEmail, ip);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    await recordEventRequestAttempt(draft.contactEmail, ip);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
