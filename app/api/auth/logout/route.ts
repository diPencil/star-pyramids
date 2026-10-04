import { NextResponse } from 'next/server';

import { destroySession } from '@/lib/server/session';
import { isSameOriginRequest } from '@/lib/server/csrf';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  await destroySession();
  return NextResponse.json({ ok: true });
}
