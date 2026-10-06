import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { getCurrentUser, isStaff } from '@/lib/server/auth';

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
    const canonical = candidates.find((r) => Array.isArray(r.aliases) && (r.aliases as unknown[]).includes(raw));
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

  return NextResponse.json({ tour });
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
  if (!isStaff(user)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  // Same-origin mutation protection
  const originOk = isSameOriginRequest(request);
  if (!originOk) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const data = await request.json();
  const { slug: paramSlug } = await params;

  // Verify tour exists
  const existing = await db.tour.findUnique({ where: { slug: paramSlug } });
  if (!existing) {
    return NextResponse.json({ error: 'Tour not found.' }, { status: 404 });
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
      (row) => row.slug !== existing.slug && Array.isArray(row.aliases) && (row.aliases as unknown[]).includes(data.slug),
    );
    if (aliasClash) {
      return NextResponse.json(
        { error: `This URL already belongs to tour "${aliasClash.slug}".` },
        { status: 409 },
      );
    }
  }

  const tour = await db.tour.update({
    where: { slug: paramSlug },
    data: {
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
      detail: data.detail,
      dayDetail: data.dayDetail,
      categorySlugs: data.categorySlugs ?? existing.categorySlugs,
      journeyVideos: data.journeyVideos ?? existing.journeyVideos,
      photoCredits: data.photoCredits ?? existing.photoCredits,
      status: data.status ?? existing.status,
    },
  });

  return NextResponse.json({ tour });
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
  if (!isStaff(user)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  // Same-origin mutation protection
  const originOk = isSameOriginRequest(request);
  if (!originOk) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const { slug: paramSlug } = await params;

  await db.tour.delete({
    where: { slug: paramSlug },
  });

  return NextResponse.json({ deleted: true });
}