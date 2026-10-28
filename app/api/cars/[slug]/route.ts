import { parseVehicleCapacity } from '@/lib/car-request';
import { catalogueTranslationResponse, saveWithCatalogueTranslations, deleteWithCatalogueTranslations } from '@/lib/server/catalogue-translations';
import { validateCatalogueTranslations } from '@/lib/catalogue-translations';
import { NextResponse } from 'next/server';
import { readJsonText, writeJsonText } from '@/lib/json-text';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { validateCarCapacityChange } from '@/lib/server/car-pricing';
import { rentCarFailure } from '@/lib/server/rent-car-errors';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Public: view a single vehicle by slug
  const { slug } = await params;
  const car = await db.car.findUnique({ where: { slug } });

  const user = await getCurrentUser();
  if (!car || (!car.isPublished && (!user || (!hasPermission(user, 'cars.edit') && !hasPermission(user, 'cars.view'))))) {
    return NextResponse.json({ notFound: true }, { status: 404 });
  }

  return NextResponse.json(await catalogueTranslationResponse('car', { car: { ...car, credit: readJsonText(car.credit) } }));
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
  if (!hasPermission(user, 'cars.edit')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const originOk = isSameOriginRequest(request);
  if (!originOk) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const data = await request.json().catch(() => null);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  if (data.seats !== undefined && (typeof data.seats !== 'string' || parseVehicleCapacity(data.seats) === null)) return NextResponse.json({ error: 'Enter an unambiguous seat capacity from 1 to 100.' }, { status: 400 });
  if (data.isPublished !== undefined && typeof data.isPublished !== 'boolean') return NextResponse.json({ error: 'Publication status must be boolean.' }, { status: 400 });
  if (data?.translations !== undefined) {
    try { validateCatalogueTranslations('car', data.translations); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid translations.' }, { status: 400 }); }
  }
  const { slug: paramSlug } = await params;

  const existing = await db.car.findUnique({ where: { slug: paramSlug } });
  if (!existing) {
    return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 });
  }

  if (data.slug && data.slug !== existing.slug) {
    const slug = String(data.slug).trim().toLowerCase();
    if (!SLUG_PATTERN.test(slug) || slug.length > 80) {
      return NextResponse.json({ error: 'Enter a valid slug.' }, { status: 400 });
    }
    const slugExists = await db.car.findUnique({ where: { slug } });
    if (slugExists) {
      return NextResponse.json({ error: 'Slug must be unique.' }, { status: 409 });
    }
  }

  try {
  const car = await saveWithCatalogueTranslations('car', data.translations, existing.slug, async (tx) => {
    await tx.$queryRaw`SELECT slug FROM cars WHERE slug = ${paramSlug} FOR UPDATE`;
    const current = await tx.car.findUnique({ where: { slug: paramSlug } });
    if (!current) throw new Error('Vehicle not found.');
    // Merge omitted fields from the locked row, rather than reverting a concurrent edit.
    const existing = current;
    await validateCarCapacityChange(tx, existing.slug, typeof data.seats === 'string' ? data.seats.trim().slice(0, 60) : existing.seats);
    return tx.car.update({
    where: { slug: paramSlug },
    data: {
      slug: data.slug ? String(data.slug).trim().toLowerCase() || existing.slug : existing.slug,
      title: typeof data.title === 'string' && data.title.trim() ? data.title.trim().slice(0, 200) : existing.title,
      image: typeof data.image === 'string' ? data.image.trim().slice(0, 2000) : existing.image,
      seats: typeof data.seats === 'string' ? data.seats.trim().slice(0, 60) : existing.seats,
      transmission: typeof data.transmission === 'string' ? data.transmission.trim().slice(0, 60) : existing.transmission,
      copy: typeof data.copy === 'string' ? data.copy.trim().slice(0, 2000) : existing.copy,
      credit: data.credit === undefined ? existing.credit : (data.credit && typeof data.credit.label === 'string' && typeof data.credit.url === 'string'
        ? writeJsonText({ label: data.credit.label.slice(0, 200), url: data.credit.url.slice(0, 2000) })
        : null),
      isPublished: data.isPublished === undefined ? existing.isPublished : data.isPublished !== false,
    },
  });
  });

  return NextResponse.json(await catalogueTranslationResponse('car', { car: { ...car, credit: readJsonText(car.credit) } }));
  } catch (error) {
    const failure = rentCarFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Staff-only delete with same-origin mutation protection.
  // Car requests keep their vehicleSlug/assignedVehicleSlug entries for
  // history; assignment is preference/ops metadata, so no request row is
  // modified or lost.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'cars.delete')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const originOk = isSameOriginRequest(request);
  if (!originOk) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const { slug: paramSlug } = await params;

  const existing = await db.car.findUnique({ where: { slug: paramSlug } });
  if (!existing) {
    return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 });
  }

  await deleteWithCatalogueTranslations('car', paramSlug, (tx) => tx.car.delete({ where: { slug: paramSlug } }));

  return NextResponse.json({ deleted: true });
}
