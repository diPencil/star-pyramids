// Deterministic bootstrap importer — authoritative source is the runtime
// `multiDayCategories` export from data/tours.ts. No text scraping, no
// fabricated records. Upsert by slug; reruns are idempotent.
import { PrismaClient } from "@prisma/client";
import { multiDayCategories } from "../data/tours";
import type { MultiDayCategory } from "../data/types";

const db = new PrismaClient();

function categoryToData(item: MultiDayCategory) {
  return {
    slug: item.slug,
    name: item.name,
    nameAr: item.nameAr,
    copy: item.copy,
    copyAr: item.copyAr,
    image: item.image,
    order: item.order ?? 999,
    active: item.active !== false,
  };
}

async function main() {
  console.log(`\n=== Importing multi-day categories from runtime catalogue ===`);
  console.log(`Source categories: ${multiDayCategories.length}`);

  let created = 0;
  let updated = 0;
  for (const item of multiDayCategories) {
    const data = categoryToData(item);
    const existing = await db.multiDayCategory.findUnique({ where: { slug: item.slug } });
    if (existing) {
      await db.multiDayCategory.update({ where: { slug: item.slug }, data });
      updated++;
    } else {
      await db.multiDayCategory.create({ data });
      created++;
    }
  }

  const totalInDb = await db.multiDayCategory.count();
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Total categories in DB: ${totalInDb}`);

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  await db.$disconnect();
  process.exit(1);
});
