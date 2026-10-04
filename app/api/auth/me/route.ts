import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { toClientUser } from '@/lib/server/users';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user: toClientUser(user) });
}
