import { NextResponse } from 'next/server';
import { db } from '@/lib/server/db';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';

/**
 * GET /api/admin/reviews/[publicId]
 * Staff-only: get single review details for inspection.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'reviews.view')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { publicId } = await params;
  if (!publicId || publicId.length > 64) {
    return NextResponse.json({ error: 'Invalid review ID.' }, { status: 400 });
  }

  const review = await db.review.findUnique({
    where: { publicId },
    select: {
      publicId: true,
      tourSlug: true,
      title: true,
      rating: true,
      text: true,
      status: true,
      createdAt: true,
      publishedAt: true,
      updatedAt: true,
      user: {
        select: {
          publicId: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!review) {
    return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
  }

  return NextResponse.json({ review });
}

/**
 * PATCH /api/admin/reviews/[publicId]
 * Staff-only: moderate a review (publish, reject, return to pending).
 * Requires reviews.moderate permission.
 * Body: { action: 'publish' | 'reject' | 'pend' }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'reviews.moderate')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { publicId } = await params;
  if (!publicId || publicId.length > 64) {
    return NextResponse.json({ error: 'Invalid review ID.' }, { status: 400 });
  }

  let body: { action: 'publish' | 'reject' | 'pend' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { action } = body;
  if (!['publish', 'reject', 'pend'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action. Must be publish, reject, or pend.' }, { status: 400 });
  }

  const review = await db.review.findUnique({
    where: { publicId },
    select: { id: true, status: true, tourSlug: true },
  });

  if (!review) {
    return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
  }

  // Validate transitions
  const validTransitions: Record<string, string[]> = {
    PENDING: ['publish', 'reject'],
    PUBLISHED: ['reject', 'pend'],
    REJECTED: ['publish', 'pend'],
  };
  if (!validTransitions[review.status]?.includes(action)) {
    return NextResponse.json({ error: `Cannot ${action} a review with status ${review.status}.` }, { status: 400 });
  }

  const newStatus = action === 'publish' ? 'PUBLISHED' : action === 'reject' ? 'REJECTED' : 'PENDING';
  const publishedAt = action === 'publish' ? new Date() : null;

  const updated = await db.review.update({
    where: { publicId },
    data: {
      status: newStatus,
      publishedAt,
    },
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
  });

  return NextResponse.json({ review: updated });
}