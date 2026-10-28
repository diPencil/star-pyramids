import { lockTourDestination, TourDestinationConflictError, validateTourPublication, validateTourWrite } from '@/lib/tour-write';
import { decodeTourJson, encodeTourJson } from '@/lib/tour-json';
import { preserveRecordSeo } from '@/lib/record-seo';
import { applyLinkedOfferDeals } from '@/lib/server/special-offers';
import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { readJsonText } from '@/lib/json-text';
import { isTourPublished } from '@/lib/tour-publish';
import { findTourDeletionBlockers, type TourDeletionBlocker } from '@/lib/server/tours';

const DELETION_BLOCKER_LABELS: Record<TourDeletionBlocker, string> = {
  bookings: 'bookings',
  tripRequests: 'trip requests',
  reviews: 'reviews',
  favorites: 'customer favorites',
  offers: 'a special offer',
  gallery: 'Journey Gallery assignments',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Public: view a single tour by slug (canonical or alias).
  const { slug: raw } = await params;
  let tour = await db.tour.findUnique({
    where: { slug: raw },
    select: {
      id: true,
      slug: true,
      aliases: true,
      title: true,
      titleAr: true,
      category: true,
      destinationSlug: true,
      cruiseType: true,
      departurePort: true,
      location: true,
      price: true,
      duration: true,
      image: true,
      gallery: true,
      galleryCaptions: true,
      summary: true,
      groupSize: true,
      travelStyle: true,
      deal: true,
      detail: true,
      dayDetail: true,
      categorySlugs: true,
      journeyVideos: true,
      photoCredits: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!tour) {
    // Alias resolution: find the canonical tour owning this alias.
    const candidates = await db.tour.findMany({ select: { slug: true, aliases: true } });
    const canonical = candidates.find((r) => Array.isArray(readJsonText(r.aliases)) && (readJsonText(r.aliases) as unknown[]).includes(raw));
    if (canonical) {
      tour = await db.tour.findUnique({
        where: { slug: canonical.slug },
        select: {
          id: true,
          slug: true,
          aliases: true,
          title: true,
          titleAr: true,
          category: true,
          destinationSlug: true,
          cruiseType: true,
          departurePort: true,
          location: true,
          price: true,
          duration: true,
          image: true,
          gallery: true,
          galleryCaptions: true,
          summary: true,
          groupSize: true,
          travelStyle: true,
          deal: true,
          detail: true,
          dayDetail: true,
          categorySlugs: true,
          journeyVideos: true,
          photoCredits: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }
  }

  if (!tour) {
    return NextResponse.json({ notFound: true }, { status: 404 });
  }

  if (!isTourPublished(tour)) {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user, 'tours.view')) {
      return NextResponse.json({ notFound: true }, { status: 404 });
    }
  }

  return NextResponse.json({ tour: decodeTourJson((await applyLinkedOfferDeals([tour]))[0]) });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Staff-only edit with same-origin mutation protection
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'tours.edit')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  // Same-origin mutation protection
  const originOk = isSameOriginRequest(request);
  if (!originOk) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  let data: Record<string, any>;
  try {
    data = await request.json();
    validateTourWrite(data, false);
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? 'Invalid tour JSON.' : error instanceof Error ? error.message : 'Invalid tour data.' }, { status: 400 });
  }
  const { slug: paramSlug } = await params;

  // Verify tour exists
  const existing = await db.tour.findUnique({ where: { slug: paramSlug } });
  if (!existing) {
    return NextResponse.json({ error: 'Tour not found.' }, { status: 404 });
  }

  if (data.expectedUpdatedAt !== undefined && data.expectedUpdatedAt !== existing.updatedAt.toISOString()) {
    return NextResponse.json({ error: 'This tour changed in another editor. Reload before saving.' }, { status: 409 });
  }

  if ((data.status ?? existing.status) === 'published') {
    try { validateTourPublication({ ...decodeTourJson(existing), price: Number(existing.price), ...data }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Incomplete trip.' }, { status: 400 }); }
  }

  // Unique slug check if slug is being changed (canonical slugs and
  // aliases share one route space).
  if (data.slug && data.slug !== existing.slug) {
    const slugExists = await db.tour.findUnique({ where: { slug: data.slug } });
    if (slugExists) {
      return NextResponse.json({ error: 'Slug must be unique.' }, { status: 409 });
    }
    const aliasRows = await db.tour.findMany({ select: { slug: true, aliases: true } });
    const aliasClash = aliasRows.find(
      (row) => row.slug !== existing.slug && Array.isArray(readJsonText(row.aliases)) && (readJsonText(row.aliases) as unknown[]).includes(data.slug),
    );
    if (aliasClash) {
      return NextResponse.json(
        { error: `This URL already belongs to tour "${aliasClash.slug}".` },
        { status: 409 },
      );
    }
  }

  let tour;
  try {
    tour = await db.$transaction(async tx => {
    await lockTourDestination(tx, data.destinationSlug === undefined ? existing.destinationSlug : data.destinationSlug);
    return tx.tour.update({
    where: { slug: paramSlug, detail: existing.detail, updatedAt: existing.updatedAt },
    data: encodeTourJson({
      slug: data.slug || existing.slug,
      aliases: data.aliases ?? existing.aliases,
      title: data.title,
      titleAr: data.titleAr,
      category: data.category,
      destinationSlug: data.destinationSlug,
      cruiseType: data.cruiseType,
      departurePort: data.departurePort,
      location: data.location,
      price: data.price,
      duration: data.duration,
      image: data.image ?? existing.image,
      gallery: data.gallery ?? existing.gallery,
      galleryCaptions: data.galleryCaptions ?? (existing as unknown as Record<string, unknown>).galleryCaptions ?? [],
      summary: data.summary ?? existing.summary,
      groupSize: data.groupSize,
      travelStyle: data.travelStyle,
      deal: data.deal,
      detail: preserveRecordSeo(existing.detail, data.detail, true, { kind: 'tour', oldSlug: existing.slug, newSlug: data.slug || existing.slug }),
      dayDetail: data.dayDetail,
      categorySlugs: data.categorySlugs ?? existing.categorySlugs,
      journeyVideos: data.journeyVideos ?? existing.journeyVideos,
      photoCredits: data.photoCredits ?? existing.photoCredits,
      status: data.status ?? existing.status,
    }),
  });
    });

  } catch (error) {
    if (error instanceof TourDestinationConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    const code = (error as { code?: string }).code;
    if (code === 'P2002' || code === 'P2025' || code === 'P2034') return NextResponse.json({ error: 'Tour changed or its slug is already in use. Reload before saving.' }, { status: 409 });
    throw error;
  }

  return NextResponse.json({ tour: decodeTourJson((await applyLinkedOfferDeals([tour]))[0]) });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Staff-only delete with same-origin mutation protection
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'tours.delete')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  // Same-origin mutation protection
  const originOk = isSameOriginRequest(request);
  if (!originOk) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const { slug: paramSlug } = await params;

  const existing = await db.tour.findUnique({
    where: { slug: paramSlug },
    select: { slug: true, status: true, aliases: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Tour not found.' }, { status: 404 });
  }
  if (isTourPublished(existing)) {
    return NextResponse.json(
      {
        error: 'Unpublish this trip before deleting it.',
        code: 'TOUR_PUBLISHED',
      },
      { status: 409 },
    );
  }

  const aliases = readJsonText(existing.aliases);
  const blockers = await findTourDeletionBlockers(
    existing.slug,
    Array.isArray(aliases) ? aliases.filter((alias): alias is string => typeof alias === 'string') : [],
  );
  if (blockers.length) {
    return NextResponse.json(
      {
        error: `This trip is still linked to ${blockers.map((blocker) => DELETION_BLOCKER_LABELS[blocker]).join(', ')}. Keep it hidden, or remove those links before deleting it.`,
        code: 'TOUR_IN_USE',
        blockers,
      },
      { status: 409 },
    );
  }

  try {
    const result = await db.tour.deleteMany({
      where: { slug: existing.slug, status: existing.status },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: 'This trip changed while you were deleting it. Reload and try again.', code: 'TOUR_CHANGED' },
        { status: 409 },
      );
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'P2003') {
      return NextResponse.json(
        {
          error: 'This trip is still linked to other records. Keep it hidden, or remove those links before deleting it.',
          code: 'TOUR_IN_USE',
        },
        { status: 409 },
      );
    }
    throw error;
  }

  return NextResponse.json({ deleted: true });
}
