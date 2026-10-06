import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { getCurrentUser, isStaff } from '@/lib/server/auth';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Public: view a single destination by slug
  const { slug } = await params;
  const destination = await db.destination.findUnique({ where: { slug } });

  if (!destination) {
    return NextResponse.json({ notFound: true }, { status: 404 });
  }

  return NextResponse.json({ destination });
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

  const originOk = isSameOriginRequest(request);
  if (!originOk) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const data = await request.json();
  const { slug: paramSlug } = await params;

  const existing = await db.destination.findUnique({ where: { slug: paramSlug } });
  if (!existing) {
    return NextResponse.json({ error: 'Destination not found.' }, { status: 404 });
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

  const destination = await db.destination.update({
    where: { slug: paramSlug },
    data: {
      slug: data.slug ? String(data.slug).trim().toLowerCase() || existing.slug : existing.slug,
      title: typeof data.title === 'string' && data.title.trim() ? data.title.trim().slice(0, 120) : existing.title,
      nameAr: data.nameAr === undefined ? existing.nameAr : (typeof data.nameAr === 'string' && data.nameAr.trim() ? data.nameAr.trim().slice(0, 120) : null),
      image: typeof data.image === 'string' ? data.image.trim().slice(0, 2000) : existing.image,
      copy: typeof data.copy === 'string' && data.copy.trim() ? data.copy.trim().slice(0, 2000) : existing.copy,
      copyAr: data.copyAr === undefined ? existing.copyAr : (typeof data.copyAr === 'string' && data.copyAr.trim() ? data.copyAr.trim().slice(0, 2000) : null),
      showInOneDayTours: data.showInOneDayTours === undefined ? existing.showInOneDayTours : data.showInOneDayTours === true,
      showInDestinations: data.showInDestinations === undefined ? existing.showInDestinations : data.showInDestinations !== false,
      isPublished: data.isPublished === undefined ? existing.isPublished : data.isPublished !== false,
      displayOrder: data.displayOrder === undefined || data.displayOrder === '' ? existing.displayOrder : (Number.isFinite(Number(data.displayOrder)) ? Number(data.displayOrder) : existing.displayOrder),
      detail: data.detail === undefined ? existing.detail : (data.detail ?? {}),
    },
  });

  return NextResponse.json({ destination });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Staff-only delete with same-origin mutation protection.
  // Tours keep their destinationSlug entries; one-day grouping ignores
  // unknown slugs, so no tour row is modified or lost.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!isStaff(user)) {
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

  await db.destination.delete({ where: { slug: paramSlug } });

  return NextResponse.json({ deleted: true });
}
