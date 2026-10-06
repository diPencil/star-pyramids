// Deterministic bootstrap importer — authoritative source is the runtime
// `tours` export from data/tours.ts. No text scraping, no regex, no
// fabricated records. Upsert by canonical tour slug; reruns are idempotent.
import { PrismaClient } from "@prisma/client";
import { tours } from "../data/tours";
import type { Tour } from "../data/types";

const db = new PrismaClient();

function toJson(value: unknown): any {
  if (value === undefined || value === null) return null;
  // Strip readonly / prototypes so Prisma stores plain JSON.
  return JSON.parse(JSON.stringify(value));
}

function toJsonArray(value: unknown): any {
  if (value === undefined || value === null) return [];
  return JSON.parse(JSON.stringify(value));
}

function tourToData(tour: Tour) {
  return {
    slug: tour.slug,
    aliases: toJsonArray(tour.aliases ?? []),
    title: tour.title,
    titleAr: tour.titleAr ?? null,
    category: tour.category,
    destinationSlug: tour.destinationSlug ?? null,
    cruiseType: tour.cruiseType ?? null,
    departurePort: tour.departurePort ?? null,
    location: tour.location,
    price: tour.price,
    duration: tour.duration,
    image: tour.image,
    gallery: toJsonArray(tour.gallery ?? []),
    galleryCaptions: toJsonArray((tour as Tour).galleryCaptions ?? []),
    summary: tour.summary,
    groupSize: tour.groupSize ?? null,
    travelStyle: tour.travelStyle ?? null,
    deal: toJson(tour.deal ?? null),
    detail: toJson(tour.detail ?? null),
    dayDetail: toJson((tour as Tour).dayDetail ?? null),
    categorySlugs: toJsonArray(tour.categorySlugs ?? []),
    journeyVideos: toJsonArray(tour.journeyVideos ?? []),
    photoCredits: toJsonArray(tour.photoCredits ?? []),
    status: "published",
  };
}

async function main() {
  console.log(`\n=== Importing tours from runtime catalogue ===`);
  console.log(`Source tours: ${tours.length}`);

  let created = 0;
  let updated = 0;

  for (const tour of tours) {
    const data = tourToData(tour);
    const existing = await db.tour.findUnique({ where: { slug: tour.slug } });
    if (existing) {
      // Preserve admin-controlled status on update; all other fields are source truth.
      const { status: _omit, ...rest } = data;
      await db.tour.update({ where: { slug: tour.slug }, data: rest });
      updated++;
    } else {
      await db.tour.create({ data });
      created++;
    }
  }

  const totalInDb = await db.tour.count();
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Total tours in DB: ${totalInDb}`);
  console.log(`Source tours processed: ${tours.length}`);

  const srcCounts: Record<string, number> = {};
  for (const t of tours) srcCounts[t.category] = (srcCounts[t.category] ?? 0) + 1;
  console.log(`Source category counts: ${JSON.stringify(srcCounts)}`);

  const dbTours = await db.tour.findMany({ select: { category: true } });
  const dbCounts: Record<string, number> = {};
  for (const t of dbTours) dbCounts[t.category] = (dbCounts[t.category] ?? 0) + 1;
  console.log(`DB category counts: ${JSON.stringify(dbCounts)}`);

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  await db.$disconnect();
  process.exit(1);
});
