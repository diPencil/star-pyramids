import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { getCurrentUser, isStaff } from '@/lib/server/auth';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET() {
  // Public: list all multi-day categories (read-only, no auth required)
  const categories = await db.multiDayCategory.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json({ categories });
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
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    return NextResponse.json({ error: 'Enter the category name.' }, { status: 400 });
  }

  const existing = await db.multiDayCategory.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: 'Slug must be unique.' }, { status: 409 });
  }

  const category = await db.multiDayCategory.create({
    data: {
      slug,
      name: data.name.trim().slice(0, 120),
      nameAr: typeof data.nameAr === 'string' && data.nameAr.trim() ? data.nameAr.trim().slice(0, 120) : data.name.trim().slice(0, 120),
      copy: typeof data.copy === 'string' && data.copy.trim() ? data.copy.trim().slice(0, 2000) : data.name.trim().slice(0, 120),
      copyAr: typeof data.copyAr === 'string' && data.copyAr.trim() ? data.copyAr.trim().slice(0, 2000) : (typeof data.nameAr === 'string' && data.nameAr.trim() ? data.nameAr.trim().slice(0, 120) : data.name.trim().slice(0, 120)),
      image: typeof data.image === 'string' ? data.image.trim().slice(0, 2000) : '',
      order: Number.isFinite(Number(data.order)) ? Number(data.order) : 999,
      active: data.active !== false,
    },
  });

  return NextResponse.json({ category }, { status: 201 });
}
