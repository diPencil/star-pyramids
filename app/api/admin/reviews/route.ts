import { parseReviewScope, reviewScopeFilter, reviewPage } from '@/lib/review-scope';
import { reviewTrips } from '@/lib/server/review-trips';
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
  const page = reviewPage(searchParams.get('page'), 1, 1000000);
  const limit = reviewPage(searchParams.get('limit'), 20, 50);
  const skip = (page - 1) * limit;
  const status = searchParams.get('status'); // PENDING | PUBLISHED | REJECTED
  const tourSlug = searchParams.get('tourSlug');
  const q = searchParams.get('q')?.trim();

  const scope = parseReviewScope(searchParams.get('scope'));
  if (!scope) return NextResponse.json({ error: 'Invalid review scope.' }, { status: 400 });
  if (status && !['PENDING', 'PUBLISHED', 'REJECTED'].includes(status)) return NextResponse.json({ error: 'Invalid review status.' }, { status: 400 });
  const sort = searchParams.get('sort') ?? 'createdAt';
  const direction = searchParams.get('direction') === 'asc' ? 'asc' : 'desc';
  if (!['createdAt', 'rating', 'status', 'tourSlug', 'userName'].includes(sort)) return NextResponse.json({ error: 'Invalid sort.' }, { status: 400 });
  const where: Record<string, unknown> = { ...reviewScopeFilter(scope) };

  if (status && ['PENDING', 'PUBLISHED', 'REJECTED'].includes(status)) {
    where.status = status;
  }
  if (tourSlug && (tourSlug.length > 80 || (scope === 'website' && tourSlug !== '@website') || (scope === 'trips' && tourSlug === '@website'))) return NextResponse.json({ error: 'Invalid tour filter.' }, { status: 400 });
  if (tourSlug) {
    where.tourSlug = tourSlug;
  }
  if (q && q.length > 200) return NextResponse.json({ error: 'Search is too long.' }, { status: 400 });
  try {
  if (q) {
    const matchingTours = await db.tour.findMany({ where: { status: 'published', title: { contains: q } }, select: { slug: true } });
    where.OR = [
      { user: { firstName: { contains: q } } },
      { user: { lastName: { contains: q } } },
      { user: { email: { contains: q } } },
      { text: { contains: q } },
      { title: { contains: q } },
      { tourSlug: { contains: q } },
      { tourSlug: { in: matchingTours.map(tour => tour.slug) } },
    ];
  }

  const [reviews, total] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: [sort === 'userName' ? { user: { firstName: direction } } : { [sort]: direction }, { publicId: 'desc' }],
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

  const trips = await reviewTrips(reviews.map(row => row.tourSlug));
  return NextResponse.json({
    reviews: reviews.map(row => ({ ...row, trip: trips.get(row.tourSlug) ?? null })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
  } catch { return NextResponse.json({ error: 'Unable to load reviews.' }, { status: 503 }); }
}
