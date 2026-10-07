import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { getCurrentUser, isStaff } from '@/lib/server/auth';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const cleanText = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string' || !v.trim()) return null;
  return v.trim().slice(0, max);
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Public: view a single story by slug
  const { slug } = await params;
  const blog = await db.blog.findUnique({ where: { slug } });

  if (!blog) {
    return NextResponse.json({ notFound: true }, { status: 404 });
  }

  return NextResponse.json({ blog });
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

  const existing = await db.blog.findUnique({ where: { slug: paramSlug } });
  if (!existing) {
    return NextResponse.json({ error: 'Story not found.' }, { status: 404 });
  }

  if (data.slug && data.slug !== existing.slug) {
    const slug = String(data.slug).trim().toLowerCase();
    if (!SLUG_PATTERN.test(slug) || slug.length > 80) {
      return NextResponse.json({ error: 'Enter a valid slug.' }, { status: 400 });
    }
    const slugExists = await db.blog.findUnique({ where: { slug } });
    if (slugExists) {
      return NextResponse.json({ error: 'Slug must be unique.' }, { status: 409 });
    }
  }

  // Preserve the rich editorial payload unless the editor sends a replacement.
  const existingContent = (existing.content ?? {}) as Record<string, unknown>;
  const nextContent =
    data.content === undefined
      ? data.editorial === undefined
        ? existingContent
        : { ...existingContent, editorial: data.editorial }
      : (data.content ?? {});

  const blog = await db.blog.update({
    where: { slug: paramSlug },
    data: {
      slug: data.slug ? String(data.slug).trim().toLowerCase() || existing.slug : existing.slug,
      title: typeof data.title === 'string' && data.title.trim() ? data.title.trim().slice(0, 200) : existing.title,
      image: typeof data.image === 'string' ? data.image.trim().slice(0, 2000) : existing.image,
      category: typeof data.category === 'string' && data.category.trim() ? data.category.trim().slice(0, 120) : existing.category,
      date: typeof data.date === 'string' && data.date.trim() ? data.date.trim().slice(0, 120) : existing.date,
      excerpt: typeof data.excerpt === 'string' && data.excerpt.trim() ? data.excerpt.trim().slice(0, 2000) : existing.excerpt,
      isPublished: data.isPublished === undefined ? existing.isPublished : data.isPublished !== false,
      displayOrder: data.displayOrder === undefined || data.displayOrder === '' ? existing.displayOrder : (Number.isFinite(Number(data.displayOrder)) ? Number(data.displayOrder) : existing.displayOrder),
      content: nextContent,
    },
  });

  return NextResponse.json({ blog });
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
  if (!isStaff(user)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const originOk = isSameOriginRequest(request);
  if (!originOk) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const { slug: paramSlug } = await params;

  const existing = await db.blog.findUnique({ where: { slug: paramSlug } });
  if (!existing) {
    return NextResponse.json({ error: 'Story not found.' }, { status: 404 });
  }

  await db.blog.delete({ where: { slug: paramSlug } });

  return NextResponse.json({ deleted: true });
}
