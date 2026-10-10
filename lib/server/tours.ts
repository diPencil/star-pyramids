import { applyLinkedOfferDeals } from './special-offers';
// Shared server-only Tour repository/service — DB-authoritative catalogue.
// `data/tours.ts` remains the preserved source/reference and deterministic
// bootstrap source; all runtime reads in Server Components and API routes
// go through this repository (Prisma `tours` table). Alias resolution is
// preserved: every alias resolves to its canonical tour.
import "server-only";

import { db } from "./db";
import type { Tour } from "@/data/types";
import { isTourPublished } from "@/lib/tour-publish";

type DbTourRow = {
  slug: string;
  aliases: unknown;
  title: string;
  titleAr: string | null;
  category: string;
  destinationSlug: string | null;
  cruiseType: string | null;
  departurePort: string | null;
  location: string;
  price: { toString(): string } | number | string;
  duration: string;
  image: string;
  gallery: unknown;
  galleryCaptions: unknown;
  summary: string;
  groupSize: string | null;
  travelStyle: string | null;
  deal: unknown;
  manualDeal?: unknown;
  detail: unknown;
  dayDetail: unknown;
  categorySlugs: unknown;
  journeyVideos: unknown;
  photoCredits: unknown;
  status: string;
};

const asArray = (value: unknown): any[] =>
  Array.isArray(value) ? value : [];

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/** Map a Prisma Tour row to the shared `Tour` domain shape. */
export function toTour(row: DbTourRow): Tour {
  return {
    slug: row.slug,
    aliases: asStringArray(row.aliases),
    title: row.title,
    titleAr: row.titleAr ?? undefined,
    category: row.category as Tour["category"],
    destinationSlug: row.destinationSlug ?? undefined,
    categorySlugs: asStringArray(row.categorySlugs),
    cruiseType: (row.cruiseType as Tour["cruiseType"]) ?? undefined,
    departurePort: row.departurePort ?? undefined,
    location: row.location,
    price: Number(row.price.toString()),
    duration: row.duration,
    image: row.image,
    gallery: asStringArray(row.gallery),
    galleryCaptions: asArray(row.galleryCaptions) as Tour["galleryCaptions"],
    journeyVideos: asArray(row.journeyVideos) as Tour["journeyVideos"],
    photoCredits: asArray(row.photoCredits) as Tour["photoCredits"],
    summary: row.summary,
    groupSize: row.groupSize ?? undefined,
    travelStyle: row.travelStyle ?? undefined,
    status: row.status,
    manualDeal: (row.manualDeal as Tour['deal']) ?? undefined,
    deal: (row.deal as Tour["deal"]) ?? undefined,
    detail: (row.detail as Tour["detail"]) ?? undefined,
    dayDetail: (row.dayDetail as Tour["dayDetail"]) ?? undefined,
  } as Tour;
}

/** All canonical tours, ordered by title (admin + public listings). */
export async function listTours(): Promise<Tour[]> {
  const rows = await db.tour.findMany({ orderBy: { title: "asc" } });
  return (await applyLinkedOfferDeals(rows)).map((r) => toTour(r as unknown as DbTourRow));
}

/** Canonical slugs only (no aliases). */
export async function listTourSlugs(): Promise<string[]> {
  const rows = await db.tour.findMany({ select: { slug: true } });
  return rows.map((r) => r.slug);
}

/** Canonical slugs + every alias, published tours only (unpublished URLs 404). */
export async function listTourRouteSlugs(): Promise<string[]> {
  const rows = await db.tour.findMany({ select: { slug: true, aliases: true, status: true } });
  const out: string[] = [];
  for (const r of rows) {
    if (r.status !== undefined && r.status !== null && r.status !== 'published') continue;
    out.push(r.slug);
    for (const a of asStringArray(r.aliases)) out.push(a);
  }
  return out;
}

/**
 * DB-authoritative tour lookup with alias resolution.
 * Canonical slug hits directly; aliases resolve to their canonical tour.
 * Returns null for unknown slugs (callers map to notFound() / 404).
 */
export async function findTourBySlug(slug: string): Promise<Tour | null> {
  const direct = await db.tour.findUnique({ where: { slug } });
  if (direct) return toTour((await applyLinkedOfferDeals([direct]))[0] as unknown as DbTourRow);
  // Alias scan: aliases are stored as a JSON string array.
  const rows = await db.tour.findMany({ select: { slug: true, aliases: true } });
  const canonical = rows.find((r) => asStringArray(r.aliases).includes(slug));
  if (!canonical) return null;
  const full = await db.tour.findUnique({ where: { slug: canonical.slug } });
  return full ? toTour((await applyLinkedOfferDeals([full]))[0] as unknown as DbTourRow) : null;
}

/** Tours filtered by canonical category. */
export async function getToursByCategory(category: Tour["category"]): Promise<Tour[]> {
  const rows = await db.tour.findMany({
    where: { category },
    orderBy: { title: "asc" },
  });
  return (await applyLinkedOfferDeals(rows)).map((r) => toTour(r as unknown as DbTourRow));
}

/**
 * DB-backed related tours (mirrors the catalogue `getRelatedTours`
 * relevance: same departure port, then shared location tokens).
 * Returned records are the same DB rows the page renders.
 */
export async function getRelatedDbTours(tour: Tour, limit = 4): Promise<Tour[]> {
  const all = (await getToursByCategory(tour.category)).filter(isTourPublished);
  if (tour.category === "one-day-tours") {
    return all.filter((item) => item.slug !== tour.slug && item.location === tour.location).slice(0, limit);
  }
  const places = new Set(tour.location.split(",").map((place) => place.trim().toLowerCase()));
  return all
    .filter((item) => item.slug !== tour.slug && Boolean(item.detail || item.dayDetail))
    .map((item, index) => ({
      item,
      index,
      relevance:
        (tour.departurePort && item.departurePort === tour.departurePort ? 4 : 0) +
        item.location.split(",").filter((place) => places.has(place.trim().toLowerCase())).length * 2,
    }))
    .sort((a, b) => b.relevance - a.relevance || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => item);
}

/** Category counts directly from the DB (parity / admin stats). */
export async function getTourCategoryCounts(): Promise<Record<string, number>> {
  const rows = await db.tour.findMany({ select: { category: true } });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.category] = (counts[r.category] ?? 0) + 1;
  return counts;
}
