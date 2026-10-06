// Deterministic bootstrap importer — authoritative source is the runtime
// `cars` export from data/content.ts. No text scraping, no
// fabricated records. Upsert by slug; reruns are idempotent.
import { PrismaClient } from "@prisma/client";
import { cars } from "../data/content";
import type { Car } from "../data/types";

const db = new PrismaClient();

function toJson(value: unknown): any {
  return JSON.parse(JSON.stringify(value));
}

function carToData(item: Car) {
  return {
    slug: item.slug,
    title: item.title,
    image: item.image,
    seats: item.seats,
    transmission: item.transmission,
    dailyPrice: item.dailyPrice,
    copy: item.copy,
    credit: item.credit ? toJson(item.credit) : null,
    isPublished: item.isPublished !== false,
  };
}

async function main() {
  console.log(`\n=== Importing cars from runtime catalogue ===`);
  console.log(`Source cars: ${cars.length}`);

  let created = 0;
  let updated = 0;
  for (const item of cars) {
    const data = carToData(item);
    const existing = await db.car.findUnique({ where: { slug: item.slug } });
    if (existing) {
      await db.car.update({ where: { slug: item.slug }, data });
      updated++;
    } else {
      await db.car.create({ data });
      created++;
    }
  }

  const totalInDb = await db.car.count();
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Total cars in DB: ${totalInDb}`);

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  await db.$disconnect();
  process.exit(1);
});
