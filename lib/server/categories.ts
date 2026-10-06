// Shared server-only MultiDayCategory repository — DB-authoritative catalogue.
// `data/tours.ts` remains the preserved bootstrap/reference source; all
// runtime reads in Server Components and API routes go through this
// repository (Prisma `multi_day_categories` table). Membership continues
// to live on Tour.categorySlugs (see lib/server/tours.ts).
import "server-only";

import { db } from "./db";
import { getPublishedMultiDayCategories as publishedCategories } from "@/data/tours";
import type { MultiDayCategory } from "@/data/types";

type DbCategoryRow = {
  slug: string;
  name: string;
  nameAr: string;
  copy: string;
  copyAr: string;
  image: string;
  order: number;
  active: boolean;
};

/** Map a Prisma MultiDayCategory row to the shared domain shape. */
export function toCategory(row: DbCategoryRow): MultiDayCategory {
  return {
    slug: row.slug,
    name: row.name,
    nameAr: row.nameAr,
    copy: row.copy,
    copyAr: row.copyAr,
    image: row.image,
    order: row.order,
    active: row.active,
  };
}

/** All categories in admin order. */
export async function listCategories(): Promise<MultiDayCategory[]> {
  const rows = await db.multiDayCategory.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  return rows.map((r) => toCategory(r as unknown as DbCategoryRow));
}

/** Canonical slugs only. */
export async function listCategorySlugs(): Promise<string[]> {
  const rows = await db.multiDayCategory.findMany({ select: { slug: true } });
  return rows.map((r) => r.slug);
}

export async function findCategoryBySlug(slug: string): Promise<MultiDayCategory | null> {
  const row = await db.multiDayCategory.findUnique({ where: { slug } });
  return row ? toCategory(row as unknown as DbCategoryRow) : null;
}

/** Public landing: active categories in admin order. */
export async function getPublishedCategories(): Promise<MultiDayCategory[]> {
  return publishedCategories(await listCategories());
}
