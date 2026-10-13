// One-time, idempotent legacy importer. It creates missing static stories and
// fills a missing editorial payload, but never overwrites content already
// managed from the admin dashboard.
import { PrismaClient } from "@prisma/client";
import { blogs } from "../data/content";
import type { Blog } from "../data/types";
import { readJsonObject } from "../lib/json-text";

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
  const apply = process.argv.includes('--apply');
  console.log(`\n=== Importing blogs from runtime catalogue ===`);
  console.log(apply ? 'Mode: APPLY' : 'Mode: DRY RUN (pass --apply to write)');
  console.log(`Source blogs: ${blogs.length}`);

  let created = 0;
  let enriched = 0;
  let skipped = 0;
  for (let i = 0; i < blogs.length; i++) {
    const item = blogs[i];
    const data = blogToData(item, i);
    const existing = await db.blog.findUnique({ where: { slug: item.slug } });
    if (existing) {
      const content = readJsonObject(existing.content);
      if (!content.editorial && item.editorial) {
        if (apply) await db.blog.update({ where: { slug: item.slug }, data: { content: JSON.stringify({ ...content, editorial: item.editorial }) } });
        enriched++;
      } else skipped++;
    } else {
      if (apply) await db.blog.create({ data: { ...data, content: JSON.stringify(data.content) } });
      created++;
    }
  }

  const totalInDb = await db.blog.count();
  console.log(`Created: ${created}`);
  console.log(`Editorial payloads filled: ${enriched}`);
  console.log(`Already managed / skipped: ${skipped}`);
  console.log(`Total blogs in DB: ${totalInDb}`);

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  await db.$disconnect();
  process.exit(1);
});
