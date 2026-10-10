// Deterministic bootstrap importer — authoritative source is the runtime
// `offers` export from data/content.ts. No text scraping, no
// fabricated records. Upsert by slug; reruns are idempotent.
import { PrismaClient } from "@prisma/client";
import { offers } from "../data/content";
import type { Offer } from "../data/types";

const db = new PrismaClient();

function toJson(value: unknown): any {
  return JSON.parse(JSON.stringify(value));
}

function offerToData(item: Offer, index: number) {
  return {
    slug: item.slug,
    title: item.title,
    image: item.image,
    badge: item.badge,
    copy: item.copy,
    duration: item.duration ?? null,
    price: item.price ?? null,
    originalPrice: item.originalPrice ?? null,
    deadline: item.deadline ?? null,
    isPublished: true,
    displayOrder: index,
    content: toJson({
      gallery: item.gallery ?? [],
      highlights: item.highlights ?? [],
      photoCredits: item.photoCredits ?? [],
    }),
  };
}

async function main() {
  console.log(`\n=== Importing offers from runtime catalogue ===`);
  console.log(`Source offers: ${offers.length}`);

  let created = 0;
  let updated = 0;
  for (let i = 0; i < offers.length; i++) {
    const item = offers[i];
    const data = offerToData(item, i);
    const existing = await db.offer.findUnique({ where: { slug: item.slug } });
    if (existing) {
      await db.offer.update({ where: { slug: item.slug }, data });
      updated++;
    } else {
      await db.offer.create({ data });
      created++;
    }
  }

  const totalInDb = await db.offer.count();
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Total offers in DB: ${totalInDb}`);

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  await db.$disconnect();
  process.exit(1);
});
