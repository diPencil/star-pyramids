import { catalogueTranslationResponse, saveWithCatalogueTranslations, deleteWithCatalogueTranslations } from '@/lib/server/catalogue-translations';
import { preserveRecordSeo } from '@/lib/record-seo';
import { validateCatalogueTranslations } from '@/lib/catalogue-translations';
import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { applyDestinationTourChanges, destinationFailure, DestinationWriteError, publicDestinationReferences, validateDestinationWrite } from '@/lib/destination-write';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Public: view a single destination by slug
  const { slug } = await params;
  const admin = new URL(request.url).searchParams.get('admin') === '1';
  if (admin) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    if (!hasPermission(user, 'destinations.view') && !hasPermission(user, 'destinations.edit')) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
  }
  const destination = await db.destination.findUnique({ where: { slug } });

  if (!destination || (!admin && !destination.isPublished)) {
    return NextResponse.json({ notFound: true }, { status: 404 });
  }

  const visible = admin ? destination : (await publicDestinationReferences([destination], db))[0];
  return NextResponse.json(await catalogueTranslationResponse('destination', { destination: visible }), { headers: { 'Cache-Control': 'private, no-store' } });
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
  if (!hasPermission(user, 'destinations.edit')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const originOk = isSameOriginRequest(request);
  if (!originOk) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  try {
  const data = validateDestinationWrite(await request.json().catch(() => null));
  if (data.tourChanges?.length && !hasPermission(user, 'tours.edit')) return NextResponse.json({ error: 'Tour editing permission is required to change associations.' }, { status: 403 });
  if (data?.translations !== undefined) {
    try { validateCatalogueTranslations('destination', data.translations); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid translations.' }, { status: 400 }); }
  }
  const { slug: paramSlug } = await params;

  const existing = await db.destination.findUnique({ where: { slug: paramSlug } });
  if (!existing) {
    return NextResponse.json({ error: 'Destination not found.' }, { status: 404 });
  }

  if (data.expectedUpdatedAt !== undefined && data.expectedUpdatedAt !== existing.updatedAt.toISOString()) {
    return NextResponse.json({ error: 'This destination changed in another editor. Reload before saving.' }, { status: 409 });
  }

  if (data.slug && data.slug !== existing.slug) {
    const slug = String(data.slug).trim().toLowerCase();
    if (!SLUG_PATTERN.test(slug) || slug.length > 80) {
      return NextResponse.json({ error: 'Enter a valid slug.' }, { status: 400 });
    }
    const slugExists = await db.destination.findUnique({ where: { slug } });
    if (slugExists) {
      return NextResponse.json({ error: 'Slug must be unique.' }, { status: 409 });
    }
  }

  const destination = await saveWithCatalogueTranslations('destination', data.translations, existing.slug, async (tx) => {
  await tx.$queryRaw`SELECT slug FROM destinations WHERE slug = ${paramSlug} FOR UPDATE`;
  const updated = await tx.destination.update({
    where: { slug: paramSlug, detail: existing.detail, updatedAt: existing.updatedAt },
    data: {
      slug: data.slug ? String(data.slug).trim().toLowerCase() || existing.slug : existing.slug,
      title: typeof data.title === 'string' && data.title.trim() ? data.title.trim().slice(0, 120) : existing.title,
      nameAr: data.nameAr === undefined ? existing.nameAr : (typeof data.nameAr === 'string' && data.nameAr.trim() ? data.nameAr.trim().slice(0, 120) : null),
      image: data.image === null ? '' : typeof data.image === 'string' ? data.image.trim().slice(0, 2000) : existing.image,
      copy: typeof data.copy === 'string' ? data.copy.trim().slice(0, 2000) : existing.copy,
      copyAr: data.copyAr === undefined ? existing.copyAr : (typeof data.copyAr === 'string' && data.copyAr.trim() ? data.copyAr.trim().slice(0, 2000) : null),
      showInOneDayTours: data.showInOneDayTours === undefined ? existing.showInOneDayTours : data.showInOneDayTours === true,
      showInDestinations: data.showInDestinations === undefined ? existing.showInDestinations : data.showInDestinations !== false,
      isPublished: data.isPublished === undefined ? existing.isPublished : data.isPublished !== false,
      displayOrder: data.displayOrder === undefined ? existing.displayOrder : data.displayOrder ?? 999,
      detail: preserveRecordSeo(existing.detail, data.detail === null ? {} : data.detail, false, { kind: 'destination', oldSlug: existing.slug, newSlug: data.slug ? String(data.slug).trim().toLowerCase() || existing.slug : existing.slug })!,
    },
  });
  await applyDestinationTourChanges(tx, data.tourChanges ?? [], existing.slug);
  if (updated.slug !== existing.slug) {
    const links = await tx.tour.findMany({ where: { destinationSlug: existing.slug }, orderBy: { slug: 'asc' }, select: { slug: true, updatedAt: true } });
    if (links.length && !hasPermission(user, 'tours.edit')) throw new DestinationWriteError('Tour editing permission is required to rename a linked destination.', 403);
    for (const tour of links) {
      const result = await tx.tour.updateMany({ where: { slug: tour.slug, destinationSlug: existing.slug, updatedAt: tour.updatedAt }, data: { destinationSlug: updated.slug } });
      if (result.count !== 1) throw new DestinationWriteError('Tour associations changed. Reload before renaming.', 409);
    }
  }
  return updated;
  });

  return NextResponse.json(await catalogueTranslationResponse('destination', { destination }));
  } catch (error) {
    const failure = destinationFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Staff-only delete with same-origin mutation protection.
  // Referenced destinations cannot be removed; trips must be reassigned first.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'destinations.delete')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const originOk = isSameOriginRequest(request);
  if (!originOk) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const { slug: paramSlug } = await params;

  const existing = await db.destination.findUnique({ where: { slug: paramSlug } });
  if (!existing) {
    return NextResponse.json({ error: 'Destination not found.' }, { status: 404 });
  }

  try {
  await deleteWithCatalogueTranslations('destination', paramSlug, async (tx) => {
    await tx.$queryRaw`SELECT slug FROM destinations WHERE slug = ${paramSlug} FOR UPDATE`;
    const links = await tx.tour.findMany({ where: { destinationSlug: paramSlug }, select: { slug: true } });
    if (links.length) throw new DestinationWriteError('This destination has associated tours. Reassign them before deleting.', 409);
    return tx.destination.delete({ where: { slug: paramSlug, detail: existing.detail, updatedAt: existing.updatedAt } });
  });

  return NextResponse.json({ deleted: true });
  } catch (error) {
    const failure = destinationFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
