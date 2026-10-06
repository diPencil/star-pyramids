// Deterministic bootstrap importer — authoritative source is the runtime
// `events` export from data/content.ts. No text scraping, no
// fabricated records. Upsert by slug; reruns are idempotent.
import { PrismaClient } from "@prisma/client";
import { events } from "../data/content";
import type { Event } from "../data/types";

const db = new PrismaClient();

function toJson(value: unknown): any {
  return JSON.parse(JSON.stringify(value));
}

function eventToData(item: Event) {
  return {
    slug: item.slug,
    title: item.title,
    titleAr: item.titleAr ?? null,
    image: item.image,
    date: item.date,
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
    startTime: item.startTime ?? null,
    endTime: item.endTime ?? null,
    timezone: item.timezone ?? null,
    location: item.location,
    locationAr: item.locationAr ?? null,
    venueName: item.venueName ?? null,
    venueNameAr: item.venueNameAr ?? null,
    address: item.address ?? null,
    addressAr: item.addressAr ?? null,
    city: item.city ?? null,
    cityAr: item.cityAr ?? null,
    mapQuery: item.mapQuery ?? null,
    copy: item.copy,
    copyAr: item.copyAr ?? null,
    category: item.category ?? null,
    categoryAr: item.categoryAr ?? null,
    featured: item.featured === true,
    intro: item.intro ?? null,
    introAr: item.introAr ?? null,
    pricingType: item.pricingType ?? null,
    price: item.price ?? null,
    currency: item.currency ?? null,
    capacity: item.capacity ?? null,
    bookingDeadline: item.bookingDeadline ?? null,
    organizerName: item.organizerName ?? null,
    organizerNameAr: item.organizerNameAr ?? null,
    organizerPhone: item.organizerPhone ?? null,
    organizerWhatsapp: item.organizerWhatsapp ?? null,
    organizerEmail: item.organizerEmail ?? null,
    isPublished: item.isPublished !== false,
    displayOrder: item.displayOrder ?? 999,
    content: toJson({
      gallery: item.gallery ?? [],
      highlights: item.highlights ?? [],
      program: item.program ?? [],
      included: item.included ?? [],
      includedAr: item.includedAr ?? [],
      excluded: item.excluded ?? [],
      excludedAr: item.excludedAr ?? [],
      addOns: item.addOns ?? [],
    }),
  };
}

async function main() {
  console.log(`\n=== Importing events from runtime catalogue ===`);
  console.log(`Source events: ${events.length}`);

  let created = 0;
  let updated = 0;
  for (const item of events) {
    const data = eventToData(item);
    const existing = await db.event.findUnique({ where: { slug: item.slug } });
    if (existing) {
      await db.event.update({ where: { slug: item.slug }, data });
      updated++;
    } else {
      await db.event.create({ data });
      created++;
    }
  }

  const totalInDb = await db.event.count();
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Total events in DB: ${totalInDb}`);

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  await db.$disconnect();
  process.exit(1);
});
