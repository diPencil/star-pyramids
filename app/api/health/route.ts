import { NextResponse } from 'next/server';

import { db } from '@/lib/server/db';

export async function GET() {
  let database: 'connected' | 'unavailable' = 'unavailable';
  try {
    await db.$queryRaw`SELECT 1`;
    database = 'connected';
  } catch {
    database = 'unavailable';
  }
  const status = database === 'connected' ? 200 : 503;
  return NextResponse.json(
    {
      status: database === 'connected' ? 'ok' : 'degraded',
      database,
      time: new Date().toISOString(),
    },
    { status },
  );
}
