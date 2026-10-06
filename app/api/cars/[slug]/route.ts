import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { getCurrentUser, isStaff } from '@/lib/server/auth';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Public: view a single vehicle by slug
  const { slug } = await params;
  const car = await db.car.findUnique({ where: { slug } });

  if (!car) {
    return NextResponse.json({ notFound: true }, { status: 404 });
  }

  return NextResponse.json({ car });
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

  const dailyPrice = data.dailyPrice === undefined ? existing.dailyPrice : Number(data.dailyPrice);

  const car = await db.car.update({
    where: { slug: paramSlug },
    data: {
      slug: data.slug ? String(data.slug).trim().toLowerCase() || existing.slug : existing.slug,
      title: typeof data.title === 'string' && data.title.trim() ? data.title.trim().slice(0, 200) : existing.title,
      image: typeof data.image === 'string' ? data.image.trim().slice(0, 2000) : existing.image,
      seats: typeof data.seats === 'string' ? data.seats.trim().slice(0, 60) : existing.seats,
      transmission: typeof data.transmission === 'string' ? data.transmission.trim().slice(0, 60) : existing.transmission,
      dailyPrice: Number.isFinite(dailyPrice) && (dailyPrice as number) >= 0 ? (dailyPrice as number) : existing.dailyPrice,
      copy: typeof data.copy === 'string' ? data.copy.trim().slice(0, 2000) : existing.copy,
      credit: data.credit === undefined ? (existing.credit === null ? Prisma.JsonNull : existing.credit) : (data.credit && typeof data.credit.label === 'string' && typeof data.credit.url === 'string'
        ? { label: data.credit.label.slice(0, 200), url: data.credit.url.slice(0, 2000) }
        : Prisma.JsonNull),
      isPublished: data.isPublished === undefined ? existing.isPublished : data.isPublished !== false,
    },
  });

  return NextResponse.json({ car });
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
  if (!isStaff(user)) {
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

  await db.car.delete({ where: { slug: paramSlug } });

  return NextResponse.json({ deleted: true });
}
