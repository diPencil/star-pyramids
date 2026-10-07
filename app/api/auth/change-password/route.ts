import { NextResponse } from 'next/server';

import {
  changePassword,
  getCurrentUser,
} from '@/lib/server/auth';
import { getSession } from '@/lib/server/session';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  checkPasswordResetRateLimit,
  recordPasswordResetAttempt,
} from '@/lib/server/rate-limit';
import {
  validatePasswordStrength,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from '@/lib/core/validation';

function requestIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 64) ||
    'unknown'
  );
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!currentUser.roles.includes('CUSTOMER')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const currentPassword = typeof (body as { currentPassword?: unknown }).currentPassword === 'string'
    ? (body as { currentPassword: string }).currentPassword
    : '';
  const newPassword = typeof (body as { newPassword?: unknown }).newPassword === 'string'
    ? (body as { newPassword: string }).newPassword
    : '';
  const confirmPassword = typeof (body as { confirmPassword?: unknown }).confirmPassword === 'string'
    ? (body as { confirmPassword: string }).confirmPassword
    : '';

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json(
      { error: 'All fields are required.' },
      { status: 400 },
    );
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: 'The new passwords do not match.' },
      { status: 400 },
    );
  }
  // Enforce the same password policy: 6-8 characters inclusive.
  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }
  // Prevent setting the same password (server-side backstop; the
  // changePassword service also rejects it after hash comparison).
  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: 'The new password must be different from the current password.' },
      { status: 400 },
    );
  }

  // Rate limit (brute-force protection on the current-password check).
  const ipAddress = requestIp(request);
  const rateLimit = await checkPasswordResetRateLimit(currentUser.email, ipAddress);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }
  await recordPasswordResetAttempt(currentUser.email, ipAddress);

  // Keep the current session valid; revoke all other sessions.
  const session = await getSession();
  const result = await changePassword(
    currentUser.id,
    currentPassword,
    newPassword,
    session?.id,
  );
  if ('failure' in result) {
    const message =
      result.failure === 'invalid-current'
        ? 'Your current password is incorrect.'
        : 'The new password must be different from the current password.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}