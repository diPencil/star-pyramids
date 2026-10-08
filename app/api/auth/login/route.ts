import { NextResponse } from 'next/server';

import { validateCredentials } from '@/lib/server/auth';
import { authorizedPostLoginPath } from '@/lib/server/auth-navigation';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { createSession } from '@/lib/server/session';
import {
  checkLoginRateLimit,
  recordLoginAttempt,
  clearLoginAttempts,
} from '@/lib/server/rate-limit';
import { toClientUser } from '@/lib/server/users';

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
  const identifierRaw = typeof (body as { identifier?: unknown }).identifier === 'string'
    ? ((body as { identifier: string }).identifier ?? '')
    : '';
  const identifier = (identifierRaw || email).trim();
  const password = typeof (body as { password?: unknown }).password === 'string'
    ? ((body as { password: string }).password ?? '')
    : '';
  const next = typeof (body as { next?: unknown }).next === 'string'
    ? (body as { next: string }).next
    : undefined;

  const forwarded = request.headers.get('x-forwarded-for');
  const ipAddress = forwarded?.split(',')[0]?.trim() ?? 'unknown';

  const rateLimit = await checkLoginRateLimit(identifier, ipAddress);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const result = await validateCredentials(identifier, password);
  if ('failure' in result) {
    await recordLoginAttempt(identifier, ipAddress, false);
    const status = result.failure === 'invalid-credentials' ? 401 : 403;
    const message =
      result.failure === 'suspended'
        ? 'Account is suspended.'
        : result.failure === 'pending'
          ? 'Account is pending activation.'
          : 'Invalid email, username or password.';
    return NextResponse.json({ error: message }, { status });
  }

  await recordLoginAttempt(identifier, ipAddress, true);
  await clearLoginAttempts(identifier, ipAddress);
  await createSession(result.user.id, {
    ipAddress: ipAddress !== 'unknown' ? ipAddress : undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({
    user: toClientUser(result.user),
    redirectTo: authorizedPostLoginPath(result.user, next),
  });
}
