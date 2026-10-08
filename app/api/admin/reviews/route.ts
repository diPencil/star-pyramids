import { NextResponse } from 'next/server';
import { db } from '@/lib/server/db';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';

/**
 * GET /api/admin/reviews
 * Staff-only: list reviews with filtering, search, pagination.
 * Supports filters: status, tourSlug, search (user name/email, review text)
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'reviews.view')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;
  const status = searchParams.get('status'); // PENDING | PUBLISHED | REJECTED
  const tourSlug = searchParams.get('tourSlug');
  const q = searchParams.get('q')?.trim();

  const where: Record<string, unknown> = {};

  if (status && ['PENDING', 'PUBLISHED', 'REJECTED'].includes(status)) {
    where.status = status;
  }
  if (tourSlug && tourSlug.length <= 80) {
    where.tourSlug = tourSlug;
  }
  if (q) {
    where.OR = [
      { user: { firstName: { contains: q, mode: 'insensitive' } } },
      { user: { lastName: { contains: q, mode: 'insensitive' } } },
      { user: { email: { contains: q, mode: 'insensitive' } } },
      { text: { contains: q, mode: 'insensitive' } },
      { title: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [reviews, total] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        publicId: true,
        tourSlug: true,
        title: true,
        rating: true,
        text: true,
        status: true,
        createdAt: true,
        publishedAt: true,
        user: {
          select: {
            publicId: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    db.review.count({ where }),
  ]);

  return NextResponse.json({
    reviews,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}