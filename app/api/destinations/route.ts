import { catalogueTranslationResponse, saveWithCatalogueTranslations } from '@/lib/server/catalogue-translations';
import { preserveRecordSeo } from '@/lib/record-seo';
import { validateCatalogueTranslations } from '@/lib/catalogue-translations';
import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { applyDestinationTourChanges, destinationFailure, publicDestinationReferences, validateDestinationWrite } from '@/lib/destination-write';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(request: Request) {
  const admin = new URL(request.url).searchParams.get('admin') === '1';
  if (admin) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    if (!hasPermission(user, 'destinations.view') && !hasPermission(user, 'destinations.edit')) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
  }
  const destinations = await db.destination.findMany({
    where: admin ? {} : { isPublished: true },
    orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
  });
  const visible = admin ? destinations : await publicDestinationReferences(destinations, db);
  return NextResponse.json(await catalogueTranslationResponse('destination', { destinations: visible }), { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  // Staff-only create with same-origin mutation protection
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'destinations.create')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const originOk = isSameOriginRequest(request);
  if (!originOk) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  try {
  const data = validateDestinationWrite(await request.json().catch(() => null), true);
  if (data.tourChanges?.length && !hasPermission(user, 'tours.edit')) return NextResponse.json({ error: 'Tour editing permission is required to change associations.' }, { status: 403 });
  if (data?.translations !== undefined) {
    try { validateCatalogueTranslations('destination', data.translations); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid translations.' }, { status: 400 }); }
  }

  const slug = typeof data.slug === 'string' ? data.slug.trim().toLowerCase() : '';
  if (!SLUG_PATTERN.test(slug) || slug.length > 80) {
    return NextResponse.json({ error: 'Enter a valid slug: lowercase letters, numbers, and hyphens.' }, { status: 400 });
  }
  if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
    return NextResponse.json({ error: 'Enter the destination name.' }, { status: 400 });
  }
  const title = data.title.trim();

  const existing = await db.destination.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: 'Slug must be unique.' }, { status: 409 });
  }

  const destination = await saveWithCatalogueTranslations('destination', data.translations, undefined, async (tx) => {
  const created = await tx.destination.create({
    data: {
      slug,
      title,
      nameAr: typeof data.nameAr === 'string' && data.nameAr.trim() ? data.nameAr.trim().slice(0, 120) : null,
      image: typeof data.image === 'string' ? data.image.trim().slice(0, 2000) : '',
      copy: typeof data.copy === 'string' ? data.copy.trim().slice(0, 2000) : title,
      copyAr: typeof data.copyAr === 'string' && data.copyAr.trim() ? data.copyAr.trim().slice(0, 2000) : null,
      showInOneDayTours: data.showInOneDayTours === true,
      showInDestinations: data.showInDestinations !== false,
      isPublished: data.isPublished !== false,
      displayOrder: data.displayOrder ?? 999,
      detail: preserveRecordSeo({}, data.detail ?? {})!,
    },
  });
  await applyDestinationTourChanges(tx, data.tourChanges ?? [], created.slug);
  return created;
  });

  return NextResponse.json(await catalogueTranslationResponse('destination', { destination }), { status: 201 });
  } catch (error) {
    const failure = destinationFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
