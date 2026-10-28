import { NextResponse } from 'next/server';
import { db } from '@/lib/server/db';
import { getCurrentUser } from '@/lib/server/auth';
import { Prisma } from '@prisma/client';
import { WEBSITE_REVIEW_SCOPE, parseReviewScope, reviewScopeFilter, reviewPage } from '@/lib/review-scope';
import { reviewTrips } from '@/lib/server/review-trips';
import { isSameOriginRequest } from '@/lib/server/csrf';

const REVIEW_ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const REVIEW_ATTEMPT_LIMIT = 5;

/**
 * POST /api/reviews
 * Authenticated CUSTOMER submits a review for a tour.
 * Server-side validates:
 * - rating range (1-5)
 * - text content
 * - tour existence
 * - authenticated customer
 * - duplicate-review policy (one review per user per tour)
 * - rate limiting per user/ip
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
  // Rate limiting: per user OR ip inside time window
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 64) ?? 'unknown';
  const recentAttempts = await db.reviewAttempt.count({
    where: {
      OR: [
        { userId: user.id, createdAt: { gte: new Date(Date.now() - REVIEW_ATTEMPT_WINDOW_MS) } },
        { ipAddress: ip, createdAt: { gte: new Date(Date.now() - REVIEW_ATTEMPT_WINDOW_MS) } },
      ],
    },
  });
  if (recentAttempts >= REVIEW_ATTEMPT_LIMIT) {
    return NextResponse.json({ error: 'Too many review attempts. Please try again later.' }, { status: 429 });
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  const values = body as Record<string, unknown>;
  const { rating, text, title } = values;
  if (values.scope !== undefined && !['website', 'trips'].includes(String(values.scope))) return NextResponse.json({ error: 'Invalid review scope.' }, { status: 400 });
  const website = values.scope === 'website';
  const tourSlug = website ? WEBSITE_REVIEW_SCOPE : values.tourSlug;

  // Validate tourSlug
  if (!tourSlug || typeof tourSlug !== 'string' || tourSlug.length > 80) {
    return NextResponse.json({ error: 'Select a valid tour.' }, { status: 400 });
  }

  // Verify tour exists
  const tour = website ? true : tourSlug === WEBSITE_REVIEW_SCOPE ? null : await db.tour.findUnique({ where: { slug: tourSlug }, select: { slug: true, status: true } });
  if (!tour || (tour !== true && tour.status !== 'published')) {
    return NextResponse.json({ error: 'Tour not found.' }, { status: 404 });
  }

  // Validate rating (1-5)
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be an integer between 1 and 5.' }, { status: 400 });
  }

  // Validate text
  const trimmedText = typeof text === 'string' ? text.trim() : '';
  if (!trimmedText || trimmedText.length < 10 || trimmedText.length > 5000) {
    return NextResponse.json({ error: 'Review text must be between 10 and 5000 characters.' }, { status: 400 });
  }

  // Validate optional title
  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  if (trimmedTitle && trimmedTitle.length > 160) {
    return NextResponse.json({ error: 'Title must be 160 characters or fewer.' }, { status: 400 });
  }

  // Duplicate-review policy: one review per user per tour
  const existing = await db.review.findUnique({
    where: { userId_tourSlug: { userId: user.id, tourSlug } },
    select: { id: true, status: true },
  });
  if (existing) {
    return NextResponse.json({ error: website ? 'You have already submitted a website review.' : 'You have already submitted a review for this tour.' }, { status: 409 });
  }

  // Record attempt (abuse protection)
  await db.reviewAttempt.create({
    data: { userId: user.id, ipAddress: ip, tourSlug },
  });

  // Create review (starts as PENDING, requires admin moderation)
  try {
  const review = await db.review.create({
    data: {
      userId: user.id,
      tourSlug,
      rating,
      text: trimmedText,
      title: trimmedTitle || null,
      status: 'PENDING',
    },
    select: {
      publicId: true,
      tourSlug: true,
      rating: true,
      title: true,
      text: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'You have already submitted this review.' }, { status: 409 });
    return NextResponse.json({ error: 'Unable to save review. Please try again.' }, { status: 500 });
  }
  } catch { return NextResponse.json({ error: 'Unable to submit review. Please try again.' }, { status: 503 }); }
}

/**
 * GET /api/reviews?tourSlug=xxx
 * Public endpoint: returns PUBLISHED reviews for a tour with pagination.
 * Also returns rating summary (average, count).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = parseReviewScope(searchParams.get('scope'));
  if (!scope) return NextResponse.json({ error: 'Invalid review scope.' }, { status: 400 });
  const requestedSlug = searchParams.get('tourSlug');
  if (requestedSlug === WEBSITE_REVIEW_SCOPE) return NextResponse.json({ error: 'Tour not found.' }, { status: 404 });
  if (requestedSlug && (requestedSlug.length > 80 || scope === 'website')) return NextResponse.json({ error: 'Invalid tour filter.' }, { status: 400 });
  const page = reviewPage(searchParams.get('page'), 1, 1000000);
  const limit = reviewPage(searchParams.get('limit'), 10, 20);
  try {
    if (requestedSlug) {
      const tour = await db.tour.findUnique({ where: { slug: requestedSlug }, select: { slug: true, status: true } });
      if (!tour || tour.status !== 'published') return NextResponse.json({ error: 'Tour not found.' }, { status: 404 });
    }
    const where = { status: 'PUBLISHED' as const, ...reviewScopeFilter(scope), ...(requestedSlug ? { tourSlug: requestedSlug } : {}) };
    const [reviews, total, stats] = await Promise.all([
      db.review.findMany({ where, orderBy: [{ publishedAt: 'desc' }, { publicId: 'desc' }], skip: (page - 1) * limit, take: limit,
        select: { publicId: true, tourSlug: true, rating: true, title: true, text: true, publishedAt: true, user: { select: { firstName: true, lastName: true } } } }),
      db.review.count({ where }),
      db.review.aggregate({ where, _avg: { rating: true }, _count: { rating: true } }),
    ]);
    const trips = await reviewTrips(reviews.map(row => row.tourSlug));
    return NextResponse.json({
      reviews: reviews.map(row => ({
        publicId: row.publicId, rating: row.rating, title: row.title, text: row.text, publishedAt: row.publishedAt,
        reviewerName: [row.user?.firstName?.trim(), row.user?.lastName?.trim()].filter(Boolean).join(' ') || 'Traveler',
        scope: row.tourSlug === WEBSITE_REVIEW_SCOPE ? 'website' : 'trips',
        trip: trips.get(row.tourSlug) ?? null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: { average: stats._avg.rating === null ? null : Math.round(stats._avg.rating * 10) / 10, count: stats._count.rating },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load reviews. Please try again.' }, { status: 503 });
  }
}
