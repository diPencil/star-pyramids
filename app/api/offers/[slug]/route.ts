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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Public: view a single offer by slug
  const { slug } = await params;
  const offer = await db.offer.findUnique({ where: { slug } });

  if (!offer) {
    return NextResponse.json({ notFound: true }, { status: 404 });
  }

  return NextResponse.json({ offer: { ...offer, content: readJsonObject(offer.content) } });
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
  if (!hasPermission(user, 'offers.edit')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const originOk = isSameOriginRequest(request);
  if (!originOk) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const data = await request.json();
  const { slug: paramSlug } = await params;

  const existing = await db.offer.findUnique({ where: { slug: paramSlug } });
  if (!existing) {
    return NextResponse.json({ error: 'Offer not found.' }, { status: 404 });
  }

  if (data.slug && data.slug !== existing.slug) {
    const slug = String(data.slug).trim().toLowerCase();
    if (!SLUG_PATTERN.test(slug) || slug.length > 80) {
      return NextResponse.json({ error: 'Enter a valid slug.' }, { status: 400 });
    }
    const slugExists = await db.offer.findUnique({ where: { slug } });
    if (slugExists) {
      return NextResponse.json({ error: 'Slug must be unique.' }, { status: 409 });
    }
  }

  const existingContent = readJsonObject(existing.content);
  const hasGallery = data.gallery !== undefined;
  const hasHighlights = data.highlights !== undefined;
  const hasCredits = data.photoCredits !== undefined;
  const gallery = hasGallery ? strArray(data.gallery, 2000).slice(0, 12) : (existingContent.gallery ?? []);
  const highlights = hasHighlights ? strArray(data.highlights, 300) : (existingContent.highlights ?? []);
  const photoCredits = hasCredits
    ? (Array.isArray(data.photoCredits)
        ? (data.photoCredits as unknown[])
            .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
            .map((c) => ({
              label: typeof c.label === 'string' ? c.label.trim().slice(0, 200) : '',
              url: typeof c.url === 'string' ? c.url.trim().slice(0, 2000) : '',
            }))
            .filter((c) => c.label && c.url)
        : [])
    : (existingContent.photoCredits ?? []);

  const offer = await db.offer.update({
    where: { slug: paramSlug },
    data: {
      slug: data.slug ? String(data.slug).trim().toLowerCase() || existing.slug : existing.slug,
      title: typeof data.title === 'string' && data.title.trim() ? data.title.trim().slice(0, 200) : existing.title,
      image: typeof data.image === 'string' ? data.image.trim().slice(0, 2000) : existing.image,
      badge: typeof data.badge === 'string' && data.badge.trim() ? data.badge.trim().slice(0, 120) : existing.badge,
      copy: typeof data.copy === 'string' && data.copy.trim() ? data.copy.trim().slice(0, 2000) : existing.copy,
      duration: data.duration === undefined ? existing.duration : cleanText(data.duration, 80),
      rating: data.rating === undefined ? existing.rating : numOrNull(data.rating),
      price: data.price === undefined ? existing.price : numOrNull(data.price),
      originalPrice: data.originalPrice === undefined ? existing.originalPrice : numOrNull(data.originalPrice),
      deadline: data.deadline === undefined ? existing.deadline : cleanText(data.deadline, 120),
      isPublished: data.isPublished === undefined ? existing.isPublished : data.isPublished !== false,
      displayOrder: data.displayOrder === undefined || data.displayOrder === '' ? existing.displayOrder : (Number.isFinite(Number(data.displayOrder)) ? Number(data.displayOrder) : existing.displayOrder),
      content: writeJsonText(data.content === undefined ? { ...existingContent, gallery, highlights, photoCredits } : (data.content ?? {})),
    },
  });

  return NextResponse.json({ offer: { ...offer, content: readJsonObject(offer.content) } });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Staff-only delete with same-origin mutation protection.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'offers.delete')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const originOk = isSameOriginRequest(request);
  if (!originOk) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const { slug: paramSlug } = await params;

  const existing = await db.offer.findUnique({ where: { slug: paramSlug } });
  if (!existing) {
    return NextResponse.json({ error: 'Offer not found.' }, { status: 404 });
  }

  await db.offer.delete({ where: { slug: paramSlug } });

  return NextResponse.json({ deleted: true });
}
