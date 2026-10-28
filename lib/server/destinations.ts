// Shared server-only Destination repository — DB-authoritative catalogue.
// `data/content.ts` remains the preserved bootstrap/reference source; all
// runtime reads in Server Components and API routes go through this
// repository (Prisma `destinations` table).
import "server-only";

import { db } from "./db";
import { attachCatalogueTranslations } from "./catalogue-translations";
import type { CatalogueTranslations } from "../catalogue-translations";
import { publicDestinationReferences } from "../destination-write";
import { stripRecordSeo } from '../record-seo';
import { getPublishedOneDayDestinations as publishedOneDay } from "@/data/tours";
import type { Destination } from "@/data/types";

type DbDestinationRow = {
  translations?: CatalogueTranslations;
  slug: string;
  title: string;
  nameAr: string | null;
  image: string;
  copy: string;
  copyAr: string | null;
  showInOneDayTours: boolean;
  showInDestinations: boolean;
  isPublished: boolean;
  displayOrder: number;
  detail: unknown;
};

/** Map a Prisma Destination row to the shared `Destination` domain shape. */
export function toDestination(row: DbDestinationRow): Destination {
  const detail = (stripRecordSeo(row.detail) ?? {}) as Destination["detail"];
  return {
    translations: row.translations,
    title: row.title,
    slug: row.slug,
    image: row.image,
    copy: row.copy,
    nameAr: row.nameAr ?? undefined,
    copyAr: row.copyAr ?? undefined,
    showInOneDayTours: row.showInOneDayTours === true ? true : undefined,
    showInDestinations: row.showInDestinations === false ? false : undefined,
    isPublished: row.isPublished === false ? false : undefined,
    displayOrder: row.displayOrder,
    detail: {
      heroImage: String(detail.heroImage ?? row.image),
      heroAlt: String(detail.heroAlt ?? row.title),
      eyebrow: String(detail.eyebrow ?? ""),
      intro: String(detail.intro ?? row.copy),
      facts: Array.isArray(detail.facts) ? detail.facts : [],
      bestFor: Array.isArray(detail.bestFor) ? detail.bestFor.filter((v): v is string => typeof v === "string") : [],
      experiences: Array.isArray(detail.experiences) ? detail.experiences : [],
      rhythm: Array.isArray(detail.rhythm) ? detail.rhythm : [],
      practical: Array.isArray(detail.practical) ? detail.practical : [],
      tourSlugs: Array.isArray(detail.tourSlugs)
        ? detail.tourSlugs.filter((v): v is string => typeof v === "string")
        : [],
    },
  };
}

/** All destinations, ordered for admin/listing use. */
export async function listDestinations(): Promise<Destination[]> {
  const rows = await db.destination.findMany({ orderBy: [{ displayOrder: "asc" }, { title: "asc" }] });
  return (await attachCatalogueTranslations("destination", rows)).map((r) => toDestination(r as unknown as DbDestinationRow));
}

/** Canonical slugs only. */
export async function listDestinationSlugs(): Promise<string[]> {
  const rows = await db.destination.findMany({ where: { isPublished: true }, select: { slug: true } });
  return rows.map((r) => r.slug);
}

export async function findDestinationBySlug(slug: string): Promise<Destination | null> {
  const row = await db.destination.findUnique({ where: { slug } });
  return row ? toDestination((await attachCatalogueTranslations("destination", [row]))[0] as unknown as DbDestinationRow) : null;
}

/** Editorial landing pages: visible on /destinations + homepage. */
export async function getPublishedDestinations(): Promise<Destination[]> {
  const rows = await db.destination.findMany({
    where: { showInDestinations: true, isPublished: true },
    orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
  });
  return (await attachCatalogueTranslations("destination", await publicDestinationReferences(rows, db))).map((r) => toDestination(r as unknown as DbDestinationRow));
}

/** One Day Tours discovery sections (same ordering rules as bootstrap). */
export async function getPublishedOneDayDestinations(): Promise<Destination[]> {
  return publishedOneDay(await getPublishedDestinationDetails());
}

/** Publication controls detail URLs; listing visibility only controls editorial cards. */
export async function getPublishedDestinationDetails(): Promise<Destination[]> {
  const rows = await db.destination.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
  });
  return (await attachCatalogueTranslations("destination", await publicDestinationReferences(rows, db))).map((row) => toDestination(row as unknown as DbDestinationRow));
}
