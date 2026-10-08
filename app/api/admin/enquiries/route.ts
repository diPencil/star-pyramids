import { NextResponse } from 'next/server';
import { db } from '@/lib/server/db';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { enquirySelect } from '@/lib/server/enquiries';

/**
 * GET /api/admin/enquiries
 * Staff-only: list website enquiries with filtering, search, pagination.
 * Supports filters: status, email, sourcePage, search (name, email, subject, message)
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'enquiries.view')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Math.min(1000000, Number.parseInt(searchParams.get('page') || '1', 10) || 1));
  const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10) || 20));
  const skip = (page - 1) * limit;
  const status = searchParams.get('status');
  const email = searchParams.get('email');
  const sourcePage = searchParams.get('sourcePage');
  const q = searchParams.get('q')?.trim().slice(0, 200);

  const where: Record<string, unknown> = {};

  if (status && ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
    where.status = status;
  }
  if (email && email.length <= 190) {
    where.email = { contains: email };
  }
  if (sourcePage && sourcePage.length <= 120) {
    where.sourcePage = { contains: sourcePage };
  }
  if (q) {
    where.OR = [
      { publicId: { contains: q } },
      { sourcePage: { contains: q } },
      { name: { contains: q } },
      { email: { contains: q } },
      { subject: { contains: q } },
      { message: { contains: q } },
    ];
  }

  try {
    const [enquiries, total] = await Promise.all([
      db.websiteEnquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: enquirySelect,
      }),
      db.websiteEnquiry.count({ where }),
    ]);

    return NextResponse.json({
      enquiries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    return NextResponse.json({ error: 'Could not load enquiries.' }, { status: 503 });
  }
}
