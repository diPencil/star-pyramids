import { catalogueTranslationResponse, saveWithCatalogueTranslations } from '@/lib/server/catalogue-translations';
import { validateCatalogueTranslations } from '@/lib/catalogue-translations';
import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET() {
  // Public: list all destinations (read-only, no auth required)
  const destinations = await db.destination.findMany({
    orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
  });
  return NextResponse.json(await catalogueTranslationResponse('destination', { destinations }));
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

  const data = await request.json();
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

  const existing = await db.destination.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: 'Slug must be unique.' }, { status: 409 });
  }

  const destination = await saveWithCatalogueTranslations('destination', data.translations, undefined, (tx) => tx.destination.create({
    data: {
      slug,
      title: data.title.trim().slice(0, 120),
      nameAr: typeof data.nameAr === 'string' && data.nameAr.trim() ? data.nameAr.trim().slice(0, 120) : null,
      image: typeof data.image === 'string' ? data.image.trim().slice(0, 2000) : '',
      copy: typeof data.copy === 'string' && data.copy.trim() ? data.copy.trim().slice(0, 2000) : data.title.trim().slice(0, 120),
      copyAr: typeof data.copyAr === 'string' && data.copyAr.trim() ? data.copyAr.trim().slice(0, 2000) : null,
      showInOneDayTours: data.showInOneDayTours === true,
      showInDestinations: data.showInDestinations !== false,
      isPublished: data.isPublished !== false,
      displayOrder: Number.isFinite(Number(data.displayOrder)) ? Number(data.displayOrder) : 999,
      detail: data.detail ?? {},
    },
  }));

  return NextResponse.json(await catalogueTranslationResponse('destination', { destination }), { status: 201 });
}
