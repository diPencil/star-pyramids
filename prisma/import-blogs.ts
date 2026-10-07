// Deterministic bootstrap importer — authoritative source is the runtime
// `blogs` export from data/content.ts. No text scraping, no
// fabricated records. Upsert by slug; reruns are idempotent.
import { PrismaClient } from "@prisma/client";
import { blogs } from "../data/content";
import type { Blog } from "../data/types";

const db = new PrismaClient();

function toJson(value: unknown): any {
  return JSON.parse(JSON.stringify(value));
}

function blogToData(item: Blog, index: number) {
  return {
    slug: item.slug,
    title: item.title,
    image: item.image,
    category: item.category,
    date: item.date,
    excerpt: item.excerpt,
    isPublished: true,
    displayOrder: index,
    content: toJson({
      editorial: item.editorial ?? null,
    }),
  };
}

async function main() {
  console.log(`\n=== Importing blogs from runtime catalogue ===`);
  console.log(`Source blogs: ${blogs.length}`);

  let created = 0;
  let updated = 0;
  for (let i = 0; i < blogs.length; i++) {
    const item = blogs[i];
    const data = blogToData(item, i);
    const existing = await db.blog.findUnique({ where: { slug: item.slug } });
    if (existing) {
      await db.blog.update({ where: { slug: item.slug }, data });
      updated++;
    } else {
      await db.blog.create({ data });
      created++;
    }
  }

  const totalInDb = await db.blog.count();
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Total blogs in DB: ${totalInDb}`);

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  await db.$disconnect();
  process.exit(1);
});
