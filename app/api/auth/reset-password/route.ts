import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  checkResetSubmitRateLimit,
  recordPasswordResetAttempt,
} from '@/lib/server/rate-limit';
import { validatePasswordResetToken, consumePasswordResetToken } from '@/lib/server/auth';
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
  const token = typeof (body as { token?: unknown }).token === 'string'
    ? (body as { token: string }).token
    : '';
  const password = typeof (body as { password?: unknown }).password === 'string'
    ? (body as { password: string }).password
    : '';
  const confirmPassword = typeof (body as { confirmPassword?: unknown }).confirmPassword === 'string'
    ? (body as { confirmPassword: string }).confirmPassword
    : '';
  const ipAddress = requestIp(request);

  if (!token) {
    return NextResponse.json(
      { error: 'Invalid or missing reset token.' },
      { status: 400 },
    );
  }
  if (!password || !confirmPassword) {
    return NextResponse.json(
      { error: 'Password and confirmation are required.' },
      { status: 400 },
    );
  }
  if (password !== confirmPassword) {
    return NextResponse.json(
      { error: 'The passwords do not match.' },
      { status: 400 },
    );
  }
  // Enforce the same password policy: 6-8 characters inclusive.
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  // IP-only rate limit (the bearer token is the secret; per-IP
  // throttling prevents token-guessing without coupling budgets).
  const rateLimit = await checkResetSubmitRateLimit(ipAddress);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }
  // Record with a fixed, non-identifying key so only the IP
  // clause of the shared attempts table is exercised.
  await recordPasswordResetAttempt('reset-submit', ipAddress);

  // Validate token (constant-time-ish; generic failure messages).
  const validation = await validatePasswordResetToken(token);
  if ('failure' in validation) {
    const message =
      validation.failure === 'expired'
        ? 'This reset link has expired. Please request a new one.'
        : validation.failure === 'already-used'
        ? 'This reset link has already been used.'
        : 'Invalid reset link. Please request a new one.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Consume token and update password.
  const result = await consumePasswordResetToken(token, password);
  if ('failure' in result) {
    const message =
      result.failure === 'expired'
        ? 'This reset link has expired. Please request a new one.'
        : result.failure === 'already-used'
        ? 'This reset link has already been used.'
        : 'Invalid reset link. Please request a new one.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}