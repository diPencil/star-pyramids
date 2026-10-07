import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const cleanText = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string' || !v.trim()) return null;
  return v.trim().slice(0, max);
};

export async function GET() {
  // Public: list all events (read-only, no auth required)
  const events = await db.event.findMany({
    orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
  });
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  // Staff-only create with same-origin mutation protection
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'events.create')) {
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
    return NextResponse.json({ error: 'Enter the event title.' }, { status: 400 });
  }
  if (!data.location || typeof data.location !== 'string' || !data.location.trim()) {
    return NextResponse.json({ error: 'Enter the event location.' }, { status: 400 });
  }
  if (!data.date || typeof data.date !== 'string' || !data.date.trim()) {
    return NextResponse.json({ error: 'Enter the display date.' }, { status: 400 });
  }

  const existing = await db.event.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: 'Slug must be unique.' }, { status: 409 });
  }

  const price = data.price === undefined || data.price === null || data.price === '' ? null : Number(data.price);
  const capacity = data.capacity === undefined || data.capacity === null || data.capacity === '' ? null : Number(data.capacity);

  const event = await db.event.create({
    data: {
      slug,
      title: data.title.trim().slice(0, 200),
      titleAr: cleanText(data.titleAr, 200),
      image: typeof data.image === 'string' ? data.image.trim().slice(0, 2000) : '',
      date: data.date.trim().slice(0, 120),
      startDate: cleanText(data.startDate, 10),
      endDate: cleanText(data.endDate, 10),
      startTime: cleanText(data.startTime, 5),
      endTime: cleanText(data.endTime, 5),
      timezone: cleanText(data.timezone, 60),
      location: data.location.trim().slice(0, 120),
      locationAr: cleanText(data.locationAr, 120),
      venueName: cleanText(data.venueName, 200),
      venueNameAr: cleanText(data.venueNameAr, 200),
      address: cleanText(data.address, 500),
      addressAr: cleanText(data.addressAr, 500),
      city: cleanText(data.city, 120),
      cityAr: cleanText(data.cityAr, 120),
      mapQuery: cleanText(data.mapQuery, 200),
      copy: typeof data.copy === 'string' && data.copy.trim() ? data.copy.trim().slice(0, 2000) : data.title.trim().slice(0, 200),
      copyAr: cleanText(data.copyAr, 2000),
      category: cleanText(data.category, 120),
      categoryAr: cleanText(data.categoryAr, 120),
      featured: data.featured === true,
      intro: cleanText(data.intro, 2000),
      introAr: cleanText(data.introAr, 2000),
      pricingType: data.pricingType === 'free' || data.pricingType === 'paid' || data.pricingType === 'request' ? data.pricingType : null,
      price: Number.isFinite(price) && (price as number) >= 0 ? (price as number) : null,
      currency: cleanText(data.currency, 8)?.toUpperCase() ?? null,
      capacity: Number.isInteger(capacity) && (capacity as number) > 0 ? (capacity as number) : null,
      bookingDeadline: cleanText(data.bookingDeadline, 10),
      organizerName: cleanText(data.organizerName, 200),
      organizerNameAr: cleanText(data.organizerNameAr, 200),
      organizerPhone: cleanText(data.organizerPhone, 60),
      organizerWhatsapp: cleanText(data.organizerWhatsapp, 60),
      organizerEmail: cleanText(data.organizerEmail, 200),
      isPublished: data.isPublished !== false,
      displayOrder: Number.isFinite(Number(data.displayOrder)) ? Number(data.displayOrder) : 999,
      content: data.content ?? {},
    },
  });

  return NextResponse.json({ event }, { status: 201 });
}
