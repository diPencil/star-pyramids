import { NextResponse } from 'next/server';

import { validateCredentials } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { createSession } from '@/lib/server/session';
import {
  checkLoginRateLimit,
  recordLoginAttempt,
  clearLoginAttempts,
} from '@/lib/server/rate-limit';

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
    ? ((body as { email: string }).email ?? '')
    : '';
  const password = typeof (body as { password?: unknown }).password === 'string'
    ? ((body as { password: string }).password ?? '')
    : '';

  const forwarded = request.headers.get('x-forwarded-for');
  const ipAddress = forwarded?.split(',')[0]?.trim() ?? 'unknown';

  const rateLimit = await checkLoginRateLimit(email, ipAddress);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const result = await validateCredentials(email, password);
  if ('failure' in result) {
    await recordLoginAttempt(email, ipAddress, false);
    const status = result.failure === 'invalid-credentials' ? 401 : 403;
    const message =
      result.failure === 'suspended'
        ? 'Account is suspended.'
        : result.failure === 'pending'
          ? 'Account is pending activation.'
          : 'Invalid email or password.';
    return NextResponse.json({ error: message }, { status });
  }

  await recordLoginAttempt(email, ipAddress, true);
  await clearLoginAttempts(email, ipAddress);
  await createSession(result.user.id, {
    ipAddress: ipAddress !== 'unknown' ? ipAddress : undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({ user: result.user });
}
