// Shared server-only Event repository — DB-authoritative catalogue.
// `data/content.ts` remains the preserved bootstrap/reference source; all
// runtime reads in Server Components and API routes go through this
// repository (Prisma `events` table). Nested editorial content (gallery,
// highlights, program, included/excluded lists, add-ons) travels in the
// `content` JSON column.
import "server-only";

import { db } from "./db";
import { getPublishedEvents as publishedEvents } from "@/lib/events";
import type { Event } from "@/data/types";

type DbEventRow = {
  slug: string;
  title: string;
  titleAr: string | null;
  image: string;
  date: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string | null;
  location: string;
  locationAr: string | null;
  venueName: string | null;
  venueNameAr: string | null;
  address: string | null;
  addressAr: string | null;
  city: string | null;
  cityAr: string | null;
  mapQuery: string | null;
  copy: string;
  copyAr: string | null;
  category: string | null;
  categoryAr: string | null;
  featured: boolean;
  intro: string | null;
  introAr: string | null;
  pricingType: string | null;
  price: number | null;
  currency: string | null;
  capacity: number | null;
  bookingDeadline: string | null;
  organizerName: string | null;
  organizerNameAr: string | null;
  organizerPhone: string | null;
  organizerWhatsapp: string | null;
  organizerEmail: string | null;
  isPublished: boolean;
  displayOrder: number;
  content: unknown;
};

const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Map a Prisma Event row to the shared `Event` domain shape. */
export function toEvent(row: DbEventRow): Event {
  const content = (row.content ?? {}) as Record<string, unknown>;
  return {
    title: row.title,
    titleAr: row.titleAr ?? undefined,
    slug: row.slug,
    image: row.image,
    date: row.date,
    startDate: row.startDate ?? undefined,
    endDate: row.endDate ?? undefined,
    startTime: row.startTime ?? undefined,
    endTime: row.endTime ?? undefined,
    timezone: row.timezone ?? undefined,
    location: row.location,
    locationAr: row.locationAr ?? undefined,
    venueName: row.venueName ?? undefined,
    venueNameAr: row.venueNameAr ?? undefined,
    address: row.address ?? undefined,
    addressAr: row.addressAr ?? undefined,
    city: row.city ?? undefined,
    cityAr: row.cityAr ?? undefined,
    mapQuery: row.mapQuery ?? undefined,
    copy: row.copy,
    copyAr: row.copyAr ?? undefined,
    category: row.category ?? undefined,
    categoryAr: row.categoryAr ?? undefined,
    featured: row.featured === true ? true : undefined,
    intro: row.intro ?? undefined,
    introAr: row.introAr ?? undefined,
    pricingType: (row.pricingType as Event["pricingType"]) ?? undefined,
    price: row.price ?? undefined,
    currency: row.currency ?? undefined,
    capacity: row.capacity ?? undefined,
    bookingDeadline: row.bookingDeadline ?? undefined,
    organizerName: row.organizerName ?? undefined,
    organizerNameAr: row.organizerNameAr ?? undefined,
    organizerPhone: row.organizerPhone ?? undefined,
    organizerWhatsapp: row.organizerWhatsapp ?? undefined,
    organizerEmail: row.organizerEmail ?? undefined,
    isPublished: row.isPublished === false ? false : undefined,
    displayOrder: row.displayOrder,
    gallery: strArray(content.gallery),
    highlights: Array.isArray(content.highlights) ? content.highlights : undefined,
    program: Array.isArray(content.program) ? content.program : undefined,
    included: strArray(content.included),
    includedAr: strArray(content.includedAr),
    excluded: strArray(content.excluded),
    excludedAr: strArray(content.excludedAr),
    addOns: Array.isArray(content.addOns) ? content.addOns : undefined,
  };
}

/** All events in admin order. */
export async function listEvents(): Promise<Event[]> {
  const rows = await db.event.findMany({ orderBy: [{ displayOrder: "asc" }, { title: "asc" }] });
  return rows.map((r) => toEvent(r as unknown as DbEventRow));
}

/** Canonical slugs only. */
export async function listEventSlugs(): Promise<string[]> {
  const rows = await db.event.findMany({ select: { slug: true } });
  return rows.map((r) => r.slug);
}

export async function findEventBySlug(slug: string): Promise<Event | null> {
  const row = await db.event.findUnique({ where: { slug } });
  return row ? toEvent(row as unknown as DbEventRow) : null;
}

/** Public discovery: published events only (same rules as bootstrap). */
export async function getPublishedDbEvents(): Promise<Event[]> {
  return publishedEvents(await listEvents());
}
