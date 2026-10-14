import { catalogueTranslationResponse, saveWithCatalogueTranslations } from '@/lib/server/catalogue-translations';
import { preserveRecordSeo } from '@/lib/record-seo';
import { validateCatalogueTranslations } from '@/lib/catalogue-translations';
import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { readJsonObject } from '@/lib/json-text';
import { BlogEditorialInputError, validateBlogEditorial } from '@/lib/blog-editorial';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const cleanText = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string' || !v.trim()) return null;
  return v.trim().slice(0, max);
};

export async function GET(request: Request) {
  const adminList = new URL(request.url).searchParams.get('admin') === '1';
  if (adminList) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    if (!hasPermission(user, 'blogs.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  // Public callers receive published stories only. Drafts are admin-only.
  const blogs = await db.blog.findMany({
    ...(adminList ? {} : { where: { isPublished: true } }),
    orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
  });
  return NextResponse.json(await catalogueTranslationResponse('blog', { blogs: blogs.map((blog) => ({ ...blog, content: readJsonObject(blog.content) })) }));
}

export async function POST(request: Request) {
  // Staff-only create with same-origin mutation protection
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'blogs.create')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const originOk = isSameOriginRequest(request);
  if (!originOk) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const data = await request.json();
  if (data?.translations !== undefined) {
    try { validateCatalogueTranslations('blog', data.translations); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid translations.' }, { status: 400 }); }
  }

  const slug = typeof data.slug === 'string' ? data.slug.trim().toLowerCase() : '';
  if (!SLUG_PATTERN.test(slug) || slug.length > 80) {
    return NextResponse.json({ error: 'Enter a valid slug: lowercase letters, numbers, and hyphens.' }, { status: 400 });
  }
  if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
    return NextResponse.json({ error: 'Enter the story title.' }, { status: 400 });
  }
  if (!data.category || typeof data.category !== 'string' || !data.category.trim()) {
    return NextResponse.json({ error: 'Enter the story category.' }, { status: 400 });
  }
  if (!data.date || typeof data.date !== 'string' || !data.date.trim()) {
    return NextResponse.json({ error: 'Enter the story date.' }, { status: 400 });
  }
  if (!data.excerpt || typeof data.excerpt !== 'string' || !data.excerpt.trim()) {
    return NextResponse.json({ error: 'Enter the story excerpt.' }, { status: 400 });
  }

  const existing = await db.blog.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: 'Slug must be unique.' }, { status: 409 });
  }

  const published = data.isPublished !== false;
  let editorial;
  try {
    editorial = validateBlogEditorial(
      data.editorial ?? (data.content as Record<string, unknown> | undefined)?.editorial,
      { publishable: published },
    );
  } catch (error) {
    if (error instanceof BlogEditorialInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
  const incomingContent = data.content && typeof data.content === 'object' && !Array.isArray(data.content)
    ? data.content as Record<string, unknown>
    : {};

  const blog = await saveWithCatalogueTranslations('blog', data.translations, undefined, (tx) => tx.blog.create({
    data: {
      slug,
      title: data.title.trim().slice(0, 200),
      image: typeof data.image === 'string' ? data.image.trim().slice(0, 2000) : '',
      category: data.category.trim().slice(0, 120),
      date: data.date.trim().slice(0, 120),
      excerpt: data.excerpt.trim().slice(0, 2000),
      isPublished: published,
      displayOrder: Number.isFinite(Number(data.displayOrder)) ? Number(data.displayOrder) : 999,
      content: preserveRecordSeo({}, { ...incomingContent, editorial })!,
    },
  }));

  return NextResponse.json(await catalogueTranslationResponse('blog', { blog: { ...blog, content: readJsonObject(blog.content) } }), { status: 201 });
}
