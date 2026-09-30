import { NextResponse } from 'next/server';

import { validateCredentials } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { createSession } from '@/lib/server/session';

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
  const result = await validateCredentials(email, password);
  if ('failure' in result) {
    const status = result.failure === 'invalid-credentials' ? 401 : 403;
    const message =
      result.failure === 'suspended'
        ? 'Account is suspended.'
        : result.failure === 'pending'
          ? 'Account is pending activation.'
          : 'Invalid email or password.';
    return NextResponse.json({ error: message }, { status });
  }
  const forwarded = request.headers.get('x-forwarded-for');
  await createSession(result.user.id, {
    ipAddress: forwarded?.split(',')[0]?.trim() ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({ user: result.user });
}
