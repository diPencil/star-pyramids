import { decodeTourJson, encodeTourJson } from '@/lib/tour-json';
import { applyLinkedOfferDeals } from '@/lib/server/special-offers';
import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { readJsonText } from '@/lib/json-text';

export async function GET(request: Request) {
  // Public: list all tours (read-only, no auth required).
  // ?full=1 returns the complete Tour payload (all catalogue fields) for
  // storefront listings; the default summary keeps cards lightweight.
  const full = new URL(request.url).searchParams.get('full') === '1';
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
  // LONGTEXT galleries decode to arrays at the boundary (same contract as
  // blogs/cars/offers). Raw JSON strings would reach clients as text.
  return NextResponse.json({ tours: (await applyLinkedOfferDeals(tours)).map(decodeTourJson) });
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

  const data = await request.json();

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

  const tour = await db.tour.create({
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
      detail: data.detail,
      dayDetail: data.dayDetail,
      categorySlugs: data.categorySlugs || [],
      journeyVideos: data.journeyVideos || [],
      photoCredits: data.photoCredits || [],
      status: data.status || 'published',
    }),
  });

  return NextResponse.json({ tour: decodeTourJson((await applyLinkedOfferDeals([tour]))[0]) }, { status: 201 });
}