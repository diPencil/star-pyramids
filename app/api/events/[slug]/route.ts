import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const cleanText = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string' || !v.trim()) return null;
  return v.trim().slice(0, max);
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Public: view a single event by slug
  const { slug } = await params;
  const event = await db.event.findUnique({ where: { slug } });

  if (!event) {
    return NextResponse.json({ notFound: true }, { status: 404 });
  }

  return NextResponse.json({ event });
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
  if (!hasPermission(user, 'events.edit')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const originOk = isSameOriginRequest(request);
  if (!originOk) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const data = await request.json();
  const { slug: paramSlug } = await params;

  const existing = await db.event.findUnique({ where: { slug: paramSlug } });
  if (!existing) {
    return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  }

  if (data.slug && data.slug !== existing.slug) {
    const slug = String(data.slug).trim().toLowerCase();
    if (!SLUG_PATTERN.test(slug) || slug.length > 80) {
      return NextResponse.json({ error: 'Enter a valid slug.' }, { status: 400 });
    }
    const slugExists = await db.event.findUnique({ where: { slug } });
    if (slugExists) {
      return NextResponse.json({ error: 'Slug must be unique.' }, { status: 409 });
    }
  }

  const price = data.price === undefined ? existing.price : (data.price === null || data.price === '' ? null : Number(data.price));
  const capacity = data.capacity === undefined ? existing.capacity : (data.capacity === null || data.capacity === '' ? null : Number(data.capacity));

  const event = await db.event.update({
    where: { slug: paramSlug },
    data: {
      slug: data.slug ? String(data.slug).trim().toLowerCase() || existing.slug : existing.slug,
      title: typeof data.title === 'string' && data.title.trim() ? data.title.trim().slice(0, 200) : existing.title,
      titleAr: data.titleAr === undefined ? existing.titleAr : cleanText(data.titleAr, 200),
      image: typeof data.image === 'string' ? data.image.trim().slice(0, 2000) : existing.image,
      date: typeof data.date === 'string' && data.date.trim() ? data.date.trim().slice(0, 120) : existing.date,
      startDate: data.startDate === undefined ? existing.startDate : cleanText(data.startDate, 10),
      endDate: data.endDate === undefined ? existing.endDate : cleanText(data.endDate, 10),
      startTime: data.startTime === undefined ? existing.startTime : cleanText(data.startTime, 5),
      endTime: data.endTime === undefined ? existing.endTime : cleanText(data.endTime, 5),
      timezone: data.timezone === undefined ? existing.timezone : cleanText(data.timezone, 60),
      location: typeof data.location === 'string' && data.location.trim() ? data.location.trim().slice(0, 120) : existing.location,
      locationAr: data.locationAr === undefined ? existing.locationAr : cleanText(data.locationAr, 120),
      venueName: data.venueName === undefined ? existing.venueName : cleanText(data.venueName, 200),
      venueNameAr: data.venueNameAr === undefined ? existing.venueNameAr : cleanText(data.venueNameAr, 200),
      address: data.address === undefined ? existing.address : cleanText(data.address, 500),
      addressAr: data.addressAr === undefined ? existing.addressAr : cleanText(data.addressAr, 500),
      city: data.city === undefined ? existing.city : cleanText(data.city, 120),
      cityAr: data.cityAr === undefined ? existing.cityAr : cleanText(data.cityAr, 120),
      mapQuery: data.mapQuery === undefined ? existing.mapQuery : cleanText(data.mapQuery, 200),
      copy: typeof data.copy === 'string' && data.copy.trim() ? data.copy.trim().slice(0, 2000) : existing.copy,
      copyAr: data.copyAr === undefined ? existing.copyAr : cleanText(data.copyAr, 2000),
      category: data.category === undefined ? existing.category : cleanText(data.category, 120),
      categoryAr: data.categoryAr === undefined ? existing.categoryAr : cleanText(data.categoryAr, 120),
      featured: data.featured === undefined ? existing.featured : data.featured === true,
      intro: data.intro === undefined ? existing.intro : cleanText(data.intro, 2000),
      introAr: data.introAr === undefined ? existing.introAr : cleanText(data.introAr, 2000),
      pricingType: data.pricingType === undefined ? existing.pricingType : (data.pricingType === 'free' || data.pricingType === 'paid' || data.pricingType === 'request' ? data.pricingType : null),
      price: price === null ? null : (Number.isFinite(price) && (price as number) >= 0 ? (price as number) : existing.price),
      currency: data.currency === undefined ? existing.currency : (cleanText(data.currency, 8)?.toUpperCase() ?? null),
      capacity: capacity === null ? null : (Number.isInteger(capacity) && (capacity as number) > 0 ? (capacity as number) : existing.capacity),
      bookingDeadline: data.bookingDeadline === undefined ? existing.bookingDeadline : cleanText(data.bookingDeadline, 10),
      organizerName: data.organizerName === undefined ? existing.organizerName : cleanText(data.organizerName, 200),
      organizerNameAr: data.organizerNameAr === undefined ? existing.organizerNameAr : cleanText(data.organizerNameAr, 200),
      organizerPhone: data.organizerPhone === undefined ? existing.organizerPhone : cleanText(data.organizerPhone, 60),
      organizerWhatsapp: data.organizerWhatsapp === undefined ? existing.organizerWhatsapp : cleanText(data.organizerWhatsapp, 60),
      organizerEmail: data.organizerEmail === undefined ? existing.organizerEmail : cleanText(data.organizerEmail, 200),
      isPublished: data.isPublished === undefined ? existing.isPublished : data.isPublished !== false,
      displayOrder: data.displayOrder === undefined || data.displayOrder === '' ? existing.displayOrder : (Number.isFinite(Number(data.displayOrder)) ? Number(data.displayOrder) : existing.displayOrder),
      content: data.content === undefined ? existing.content : (data.content ?? {}),
    },
  });

  return NextResponse.json({ event });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Staff-only delete with same-origin mutation protection.
  // Event requests keep their eventSlug entries for history; the request
  // lifecycle is independent, so no request row is modified or lost.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'events.delete')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const originOk = isSameOriginRequest(request);
  if (!originOk) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const { slug: paramSlug } = await params;

  const existing = await db.event.findUnique({ where: { slug: paramSlug } });
  if (!existing) {
    return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  }

  await db.event.delete({ where: { slug: paramSlug } });

  return NextResponse.json({ deleted: true });
}
