// Shared server-only Offer repository — DB-authoritative catalogue.
// `data/content.ts` remains the preserved bootstrap/reference source; all
// runtime reads in Server Components and API routes go through this
// repository (Prisma `offers` table). Gallery, highlights and photo
// credits travel in the `content` JSON column so existing media is
// preserved exactly.
import "server-only";

import { db } from "./db";
import { readJsonObject } from '../json-text';
import type { Offer } from "@/data/types";

type DbOfferRow = {
  slug: string;
  title: string;
  image: string;
  badge: string;
  copy: string;
  duration: string | null;
  rating: number | null;
  price: number | null;
  originalPrice: number | null;
  deadline: string | null;
  isPublished: boolean;
  displayOrder: number;
  content: unknown;
};

const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Map a Prisma Offer row to the shared `Offer` domain shape. */
export function toOffer(row: DbOfferRow): Offer {
  const content = readJsonObject(row.content);
  return {
    title: row.title,
    slug: row.slug,
    image: row.image,
    gallery: strArray(content.gallery).length ? strArray(content.gallery) : undefined,
    photoCredits: Array.isArray(content.photoCredits) ? content.photoCredits : undefined,
    badge: row.badge,
    copy: row.copy,
    highlights: strArray(content.highlights).length ? strArray(content.highlights) : undefined,
    duration: row.duration ?? undefined,
    rating: row.rating ?? undefined,
    price: row.price ?? undefined,
    originalPrice: row.originalPrice ?? undefined,
    deadline: row.deadline ?? undefined,
    isPublished: row.isPublished === false ? false : undefined,
    displayOrder: row.displayOrder,
  } as Offer;
}

/** All offers in admin order (hidden included for admin use). */
export async function listOffers(): Promise<Offer[]> {
  const rows = await db.offer.findMany({ orderBy: [{ displayOrder: "asc" }, { title: "asc" }] });
  return rows.map((r) => toOffer(r as unknown as DbOfferRow));
}

/** Canonical slugs only. */
export async function listOfferSlugs(): Promise<string[]> {
  const rows = await db.offer.findMany({ select: { slug: true } });
  return rows.map((r) => r.slug);
}

export async function findOfferBySlug(slug: string): Promise<Offer | null> {
  const row = await db.offer.findUnique({ where: { slug } });
  return row ? toOffer(row as unknown as DbOfferRow) : null;
}

/** Public discovery: published offers only. */
export async function getPublishedDbOffers(): Promise<Offer[]> {
  const rows = await db.offer.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
  });
  return rows.map((r) => toOffer(r as unknown as DbOfferRow));
}
