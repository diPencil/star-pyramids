// Deterministic bootstrap importer — authoritative source is the runtime
// `destinations` export from data/content.ts. No text scraping, no
// fabricated records. Upsert by slug; reruns are idempotent.
import { PrismaClient } from "@prisma/client";
import { destinations } from "../data/content";
import type { Destination } from "../data/types";

const db = new PrismaClient();

function toJson(value: unknown): any {
  return JSON.parse(JSON.stringify(value));
}

function destinationToData(item: Destination) {
  return {
    slug: item.slug,
    title: item.title,
    nameAr: item.nameAr ?? null,
    image: item.image,
    copy: item.copy,
    copyAr: item.copyAr ?? null,
    showInOneDayTours: item.showInOneDayTours === true,
    showInDestinations: item.showInDestinations !== false,
    isPublished: item.isPublished !== false,
    displayOrder: item.displayOrder ?? 999,
    detail: toJson(item.detail),
  };
}

async function main() {
  console.log(`\n=== Importing destinations from runtime catalogue ===`);
  console.log(`Source destinations: ${destinations.length}`);

  let created = 0;
  let updated = 0;
  for (const item of destinations) {
    const data = destinationToData(item);
    const existing = await db.destination.findUnique({ where: { slug: item.slug } });
    if (existing) {
      await db.destination.update({ where: { slug: item.slug }, data });
      updated++;
    } else {
      await db.destination.create({ data });
      created++;
    }
  }

  const totalInDb = await db.destination.count();
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Total destinations in DB: ${totalInDb}`);

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  await db.$disconnect();
  process.exit(1);
});
