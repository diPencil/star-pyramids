import { NextResponse } from 'next/server';
import { db } from '@/lib/server/db';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { enquiryStaffWhere } from '@/lib/server/enquiries';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(user, 'enquiries.manage')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  try {
    const staff = await db.user.findMany({
      where: enquiryStaffWhere,
      select: { publicId: true, firstName: true, lastName: true, email: true, roles: { select: { role: { select: { key: true, name: true } } } } },
      orderBy: [{ firstName: 'asc' }, { email: 'asc' }],
    });
    return NextResponse.json({ staff });
  } catch {
    return NextResponse.json({ error: 'Could not load authorized staff.' }, { status: 503 });
  }
}
