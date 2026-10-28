import { validateTourPublication, validateTourWrite } from '@/lib/tour-write';
import { decodeTourJson, encodeTourJson } from '@/lib/tour-json';
import { preserveRecordSeo } from '@/lib/record-seo';
import { applyLinkedOfferDeals } from '@/lib/server/special-offers';
import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { readJsonText } from '@/lib/json-text';
import { isTourPublished } from '@/lib/tour-publish';
import { getTourBookingCounts } from '@/lib/server/tours';

export async function GET(request: Request) {
  // Public: list published tours. Staff with tours.view may pass ?all=1 to
  // include hidden/draft rows for the admin catalogue.
  // ?full=1 returns the complete Tour payload (all catalogue fields) for
  // storefront listings; the default summary keeps cards lightweight.
  const searchParams = new URL(request.url).searchParams;
  const full = searchParams.get('full') === '1';
  const includeAll = searchParams.get('all') === '1';
  const withBookingCounts = includeAll && searchParams.get('withBookingCounts') === '1';
  if (includeAll) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    if (!hasPermission(user, 'tours.view')) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
  }
  const tours = await db.tour.findMany({
    orderBy: { title: 'asc' },
    select: full
      ? {
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
        }
      : {
          id: true,
          slug: true,
          aliases: true,
          title: true,
          titleAr: true,
          category: true,
          location: true,
          price: true,
          duration: true,
          image: true,
          deal: true,
          status: true,
        },
  });
  const visible = includeAll ? tours : tours.filter(isTourPublished);
  const [decorated, bookingCounts] = await Promise.all([
    applyLinkedOfferDeals(visible),
    withBookingCounts ? getTourBookingCounts(visible) : Promise.resolve(null),
  ]);
  // LONGTEXT galleries decode to arrays at the boundary (same contract as
  // blogs/cars/offers). Raw JSON strings would reach clients as text.
  const records = decorated.map(decodeTourJson);
  return NextResponse.json({
    tours: bookingCounts
      ? records.map((tour) => ({ ...tour, bookingCount: bookingCounts.get(tour.slug) ?? 0 }))
      : records,
  });
}

export async function POST(request: Request) {
  // Staff-only create with same-origin mutation protection
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'tours.create')) {
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
    validateTourWrite(data, true);
    if ((data.status ?? 'published') === 'published') validateTourPublication(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? 'Invalid tour JSON.' : error instanceof Error ? error.message : 'Invalid tour data.' }, { status: 400 });
  }

  // Validate required fields
  if (!data.title || !data.slug || !data.category || typeof data.price !== 'number') {
    return NextResponse.json({ error: 'Missing required fields: title, slug, category, price.' }, { status: 400 });
  }

  // Unique slug check (canonical slugs and aliases share one route space —
  // a new slug colliding with another tour's alias would fork its URL).
  const existing = await db.tour.findUnique({ where: { slug: data.slug } });
  if (existing) {
    return NextResponse.json({ error: 'Slug must be unique.' }, { status: 409 });
  }
  const aliasOwner = await db.tour.findMany({ select: { slug: true, aliases: true } });
  const clash = aliasOwner.find(
    (row) => Array.isArray(readJsonText(row.aliases)) && (readJsonText(row.aliases) as unknown[]).includes(data.slug),
  );
  if (clash) {
    return NextResponse.json(
      { error: `This URL already belongs to tour "${clash.slug}". Open it to edit instead.` },
      { status: 409 },
    );
  }

  let tour;
  try {
    tour = await db.tour.create({
    data: encodeTourJson({
      slug: data.slug,
      aliases: data.aliases || [],
      title: data.title,
      titleAr: data.titleAr,
      category: data.category,
      destinationSlug: data.destinationSlug,
      cruiseType: data.cruiseType,
      departurePort: data.departurePort,
      location: data.location,
      price: data.price,
      duration: data.duration,
      image: data.image || '',
      gallery: data.gallery || [],
      galleryCaptions: data.galleryCaptions || [],
      summary: data.summary || '',
      groupSize: data.groupSize,
      travelStyle: data.travelStyle,
      deal: data.deal,
      detail: data.detail == null ? data.detail : preserveRecordSeo(null, data.detail, true),
      dayDetail: data.dayDetail,
      categorySlugs: data.categorySlugs || [],
      journeyVideos: data.journeyVideos || [],
      photoCredits: data.photoCredits || [],
      status: data.status || 'published',
    }),
  });

  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'P2002' || code === 'P2025') return NextResponse.json({ error: 'Tour changed or its slug is already in use. Reload before saving.' }, { status: 409 });
    throw error;
  }

  return NextResponse.json({ tour: decodeTourJson((await applyLinkedOfferDeals([tour]))[0]) }, { status: 201 });
}
