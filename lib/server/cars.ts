// Shared server-only Car repository — DB-authoritative fleet catalogue.
// `data/content.ts` remains the preserved bootstrap/reference source; all
// runtime reads in Server Components and API routes go through this
// repository (Prisma `cars` table).
import "server-only";

import { db } from "./db";
import type { Car } from "@/data/types";

type DbCarRow = {
  slug: string;
  title: string;
  image: string;
  seats: string;
  transmission: string;
  dailyPrice: number;
  copy: string;
  credit: unknown;
  isPublished: boolean;
};

/** Map a Prisma Car row to the shared `Car` domain shape. */
export function toCar(row: DbCarRow): Car {
  const credit = (row.credit ?? null) as { label?: unknown; url?: unknown } | null;
  return {
    title: row.title,
    slug: row.slug,
    image: row.image,
    seats: row.seats,
    transmission: row.transmission,
    dailyPrice: row.dailyPrice,
    copy: row.copy,
    credit:
      credit && typeof credit.label === "string" && typeof credit.url === "string"
        ? { label: credit.label, url: credit.url }
        : undefined,
    isPublished: row.isPublished === false ? false : undefined,
  };
}

/** Full fleet in admin order (hidden vehicles included for admin use). */
export async function listCars(): Promise<Car[]> {
  const rows = await db.car.findMany({ orderBy: [{ title: "asc" }] });
  return rows.map((r) => toCar(r as unknown as DbCarRow));
}

/** Canonical slugs only. */
export async function listCarSlugs(): Promise<string[]> {
  const rows = await db.car.findMany({ select: { slug: true } });
  return rows.map((r) => r.slug);
}

export async function findCarBySlug(slug: string): Promise<Car | null> {
  const row = await db.car.findUnique({ where: { slug } });
  return row ? toCar(row as unknown as DbCarRow) : null;
}

/** Public fleet: published vehicles only, in admin order. */
export async function getPublishedCars(): Promise<Car[]> {
  const rows = await db.car.findMany({
    where: { isPublished: true },
    orderBy: [{ title: "asc" }],
  });
  return rows.map((r) => toCar(r as unknown as DbCarRow));
}
