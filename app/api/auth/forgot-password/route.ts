import { NextResponse } from 'next/server';

import { db } from '@/lib/server/db';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  checkPasswordResetRateLimit,
  recordPasswordResetAttempt,
} from '@/lib/server/rate-limit';
import { createPasswordResetToken } from '@/lib/server/auth';
import { sendCustomerEmailSafe } from '@/lib/server/email';

function requestIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 64) ||
    'unknown'
  );
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const email = typeof (body as { email?: unknown }).email === 'string'
    ? (body as { email: string }).email.trim()
    : '';
  const ipAddress = requestIp(request);

  if (!email) {
    return NextResponse.json(
      { error: 'Enter your email address.' },
      { status: 400 },
    );
  }

  // Rate limit (prevents enumeration + email bombing).
  const rateLimit = await checkPasswordResetRateLimit(email, ipAddress);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }
  await recordPasswordResetAttempt(email, ipAddress);

  // Create reset token. Returns failure for missing/inactive
  // accounts, but the response below is identical either way
  // so the endpoint never reveals whether an email exists.
  const result = await createPasswordResetToken(email);
  if ('failure' in result) {
    return NextResponse.json({ success: true });
  }

  // Send reset email. The raw token travels ONLY inside the
  // email link; it is never returned in any API response.
  const { token, userId } = result;
  const resetUrl = `${new URL(request.url).origin}/reset-password?token=${encodeURIComponent(token)}`;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true },
  });
  const name = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email.split('@')[0]
    : 'there';

  // No idempotency key: password-reset emails must be
  // re-requestable, and we must not persist any token material.
  // Rate limiting above bounds how often this can fire.
  await sendCustomerEmailSafe('password_reset', email, {
    name,
    resetUrl,
  });

  return NextResponse.json({ success: true });
}