import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { readJsonObject, writeJsonText } from '@/lib/json-text';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const cleanText = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string' || !v.trim()) return null;
  return v.trim().slice(0, max);
};

const strArray = (v: unknown, max: number): string[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => x.slice(0, max))
    : [];

const numOrNull = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function GET() {
  // Public: list all offers (read-only, no auth required)
  const offers = await db.offer.findMany({
    orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
  });
  return NextResponse.json({ offers: offers.map((offer) => ({ ...offer, content: readJsonObject(offer.content) })) });
}

export async function POST(request: Request) {
  // Staff-only create with same-origin mutation protection
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'offers.create')) {
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
    return NextResponse.json({ error: 'Enter the offer title.' }, { status: 400 });
  }
  if (!data.badge || typeof data.badge !== 'string' || !data.badge.trim()) {
    return NextResponse.json({ error: 'Enter the campaign badge.' }, { status: 400 });
  }
  if (!data.copy || typeof data.copy !== 'string' || !data.copy.trim()) {
    return NextResponse.json({ error: 'Enter the offer description.' }, { status: 400 });
  }

  const existing = await db.offer.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: 'Slug must be unique.' }, { status: 409 });
  }

  const gallery = strArray(data.gallery ?? (data.content as Record<string, unknown> | undefined)?.gallery, 2000).slice(0, 12);
  const highlights = strArray(data.highlights ?? (data.content as Record<string, unknown> | undefined)?.highlights, 300);
  const rawCredits = (data.photoCredits ?? (data.content as Record<string, unknown> | undefined)?.photoCredits) as unknown;
  const photoCredits = Array.isArray(rawCredits)
    ? rawCredits
        .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
        .map((c) => ({
          label: typeof c.label === 'string' ? c.label.trim().slice(0, 200) : '',
          url: typeof c.url === 'string' ? c.url.trim().slice(0, 2000) : '',
        }))
        .filter((c) => c.label && c.url)
    : [];

  const offer = await db.offer.create({
    data: {
      slug,
      title: data.title.trim().slice(0, 200),
      image: typeof data.image === 'string' ? data.image.trim().slice(0, 2000) : '',
      badge: data.badge.trim().slice(0, 120),
      copy: data.copy.trim().slice(0, 2000),
      duration: cleanText(data.duration, 80),
      rating: numOrNull(data.rating),
      price: numOrNull(data.price),
      originalPrice: numOrNull(data.originalPrice),
      deadline: cleanText(data.deadline, 120),
      isPublished: data.isPublished !== false,
      displayOrder: Number.isFinite(Number(data.displayOrder)) ? Number(data.displayOrder) : 999,
      content: writeJsonText(data.content && typeof data.content === 'object' && !Array.isArray(data.content)
        ? data.content
        : { gallery, highlights, photoCredits }),
    },
  });

  return NextResponse.json({ offer: { ...offer, content: readJsonObject(offer.content) } }, { status: 201 });
}
