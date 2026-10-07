// Shared server-only Blog repository — DB-authoritative catalogue.
// `data/content.ts` remains the preserved bootstrap/reference source; all
// runtime reads in Server Components and API routes go through this
// repository (Prisma `blogs` table). The full rich editorial payload
// travels in the `content` JSON column so existing content is preserved
// exactly.
import "server-only";

import { db } from "./db";
import type { Blog } from "@/data/types";

type DbBlogRow = {
  slug: string;
  title: string;
  image: string;
  category: string;
  date: string;
  excerpt: string;
  isPublished: boolean;
  displayOrder: number;
  content: unknown;
};

/** Map a Prisma Blog row to the shared `Blog` domain shape. */
export function toBlog(row: DbBlogRow): Blog {
  const content = (row.content ?? {}) as Record<string, unknown>;
  const editorial = (content.editorial ?? null) as Blog["editorial"];
  return {
    title: row.title,
    slug: row.slug,
    image: row.image,
    category: row.category,
    date: row.date,
    excerpt: row.excerpt,
    editorial: editorial ?? undefined,
    isPublished: row.isPublished === false ? false : undefined,
    displayOrder: row.displayOrder,
  } as Blog;
}

/** All stories in admin order (hidden included for admin use). */
export async function listBlogs(): Promise<Blog[]> {
  const rows = await db.blog.findMany({ orderBy: [{ displayOrder: "asc" }, { title: "asc" }] });
  return rows.map((r) => toBlog(r as unknown as DbBlogRow));
}

/** Canonical slugs only. */
export async function listBlogSlugs(): Promise<string[]> {
  const rows = await db.blog.findMany({ select: { slug: true } });
  return rows.map((r) => r.slug);
}

export async function findBlogBySlug(slug: string): Promise<Blog | null> {
  const row = await db.blog.findUnique({ where: { slug } });
  return row ? toBlog(row as unknown as DbBlogRow) : null;
}

/** Public discovery: published stories only. */
export async function getPublishedDbBlogs(): Promise<Blog[]> {
  const rows = await db.blog.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
  });
  return rows.map((r) => toBlog(r as unknown as DbBlogRow));
}
