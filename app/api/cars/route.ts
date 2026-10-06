import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { getCurrentUser, isStaff } from '@/lib/server/auth';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET() {
  // Public: list the full fleet (read-only, no auth required)
  const cars = await db.car.findMany({ orderBy: [{ title: 'asc' }] });
  return NextResponse.json({ cars });
}

export async function POST(request: Request) {
  // Staff-only create with same-origin mutation protection
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

  const slug = typeof data.slug === 'string' ? data.slug.trim().toLowerCase() : '';
  if (!SLUG_PATTERN.test(slug) || slug.length > 80) {
    return NextResponse.json({ error: 'Enter a valid slug: lowercase letters, numbers, and hyphens.' }, { status: 400 });
  }
  if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
    return NextResponse.json({ error: 'Enter the vehicle title.' }, { status: 400 });
  }
  const dailyPrice = Number(data.dailyPrice);
  if (!Number.isFinite(dailyPrice) || dailyPrice < 0) {
    return NextResponse.json({ error: 'Enter a valid daily rate.' }, { status: 400 });
  }

  const existing = await db.car.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: 'Slug must be unique.' }, { status: 409 });
  }

  const credit =
    data.credit && typeof data.credit.label === 'string' && typeof data.credit.url === 'string'
      ? { label: data.credit.label.slice(0, 200), url: data.credit.url.slice(0, 2000) }
      : Prisma.JsonNull;

  const car = await db.car.create({
    data: {
      slug,
      title: data.title.trim().slice(0, 200),
      image: typeof data.image === 'string' ? data.image.trim().slice(0, 2000) : '',
      seats: typeof data.seats === 'string' ? data.seats.trim().slice(0, 60) : '',
      transmission: typeof data.transmission === 'string' ? data.transmission.trim().slice(0, 60) : '',
      dailyPrice,
      copy: typeof data.copy === 'string' ? data.copy.trim().slice(0, 2000) : '',
      credit,
      isPublished: data.isPublished !== false,
    },
  });

  return NextResponse.json({ car }, { status: 201 });
}
