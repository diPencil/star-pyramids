// Journey Gallery legacy import — EXPLICIT, IDEMPOTENT, NON-DESTRUCTIVE.
//
// Seeds the five long-standing homepage gallery photos (the exact
// `galItems` the homepage rendered before the gallery became
// database-driven) as published IMAGE rows targeted at the homepage
// photo row. Reruns change nothing: rows are upserted by `mediaHash`
// (SHA-256 of the trimmed URL), so duplicates are structurally
// impossible.
//
// Per-tour `journeyVideos` JSON is intentionally NOT imported: the
// tour-detail carousel merges those legacy entries at read time, so
// importing them would duplicate content. Nothing here deletes,
// rewrites, or overwrites existing rows or media.
//
// DO NOT RUN AUTOMATICALLY. Run only with explicit authorization,
// AFTER applying prisma/migrations/20261013000000_journey_gallery
// and regenerating the client (`pnpm db:generate`):
//
//   pnpm db:deploy && pnpm db:generate && pnpm tsx scripts/import-journey-gallery.ts
import { createHash } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const LEGACY_PHOTOS: Array<{ mediaUrl: string; title: string; sortOrder: number }> = [
  // Mirrors components/homepage.tsx `galItems` (order preserved).
  // `images[1..3]` resolve at runtime from components/site.tsx; the
  // concrete paths below are the values those entries hold today.
  { mediaUrl: '', title: 'Giza Pyramids, Cairo', sortOrder: 10 },
  { mediaUrl: '', title: 'Nile River, Aswan', sortOrder: 20 },
  { mediaUrl: '', title: 'Ancient Temples, Luxor', sortOrder: 30 },
  { mediaUrl: '/egypt-hero.png', title: 'Karnak Temple, Luxor', sortOrder: 40 },
  { mediaUrl: '', title: 'White Desert Adventure', sortOrder: 50 },
];

async function resolveSiteImages(): Promise<{ images: string[]; desert: string }> {
  const site = await import('../components/site');
  const content = await import('../data/content');
  const images = (site as { images?: unknown }).images;
  const desert = (content as { siteImages?: { desert?: unknown } }).siteImages?.desert;
  if (!Array.isArray(images) || typeof desert !== 'string') {
    throw new Error('Could not resolve legacy gallery sources from components/site and data/content.');
  }
  return { images: images as string[], desert };
}

async function main(): Promise<void> {
  const { images, desert } = await resolveSiteImages();
  const photos = LEGACY_PHOTOS.map((photo, index) => {
    if (photo.mediaUrl) return photo;
    const resolved = index === 0 ? images[1] : index === 1 ? images[2] : index === 2 ? images[3] : desert;
    if (typeof resolved !== 'string' || !resolved) {
      throw new Error(`Legacy photo #${index + 1} resolved to an empty path — refusing to seed placeholders.`);
    }
    return { ...photo, mediaUrl: resolved };
  });

  let created = 0;
  let kept = 0;
  for (const photo of photos) {
    const mediaUrl = photo.mediaUrl.trim();
    const mediaHash = createHash('sha256').update(mediaUrl).digest('hex');
    const existing = await db.journeyGalleryItem.findUnique({ where: { mediaHash } });
    if (existing) {
      kept += 1;
      continue;
    }
    await db.journeyGalleryItem.create({
      data: {
        mediaType: 'IMAGE',
        mediaUrl,
        mediaHash,
        platform: null,
        title: photo.title,
        titleAr: null,
        caption: null,
        thumbnail: null,
        showOnHomepage: true,
        showOnTours: false,
        tourScope: 'SELECTED_TOURS',
        isPublished: true,
        sortOrder: photo.sortOrder,
      },
    });
    created += 1;
  }
  console.log(`Journey gallery legacy import: created ${created}, already present ${kept}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
