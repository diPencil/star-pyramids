// Journey Gallery repository — server-owned persistence.
//
// Single source of truth for gallery CRUD, public reads, and tour
// visibility resolution. Validation lives in lib/journey-gallery.ts
// (shared, unit-tested); this module owns hashing, mapping, and storage.
//
// Implementation note: gallery tables are accessed through parameterized
// raw statements (`$queryRaw`/`$executeRaw`) rather than generated
// delegates, so this module typechecks and runs against any generated
// client of this schema. Run `prisma migrate deploy` (only when
// explicitly authorized) to create the tables; see
// prisma/migrations/20261013000000_journey_gallery/migration.sql.
import 'server-only';

import { createHash } from 'node:crypto';

import { Prisma } from '@prisma/client';

import { db } from './db';
import {
  normalizeGalleryMediaUrl,
  sortGalleryItems,
  validateGalleryPayload,
  validateGalleryOrder,
  type GalleryItem,
  type GalleryPayload,
} from '../journey-gallery';

/** Stable dedup identity: SHA-256 of the normalized media URL. */
export function hashGalleryMediaUrl(mediaUrl: string): string {
  return createHash('sha256').update(normalizeGalleryMediaUrl(mediaUrl)).digest('hex');
}

type GalleryRow = {
  id: string;
  mediaType: string;
  mediaUrl: string;
  platform: string | null;
  title: string;
  titleAr: string | null;
  caption: string | null;
  thumbnail: string | null;
  showOnHomepage: number | boolean;
  showOnTours: number | boolean;
  tourScope: string;
  isPublished: number | boolean;
  sortOrder: number | bigint;
  createdAt: Date;
  updatedAt: Date;
};

const truthy = (value: number | boolean | null | undefined): boolean =>
  value === true || Number(value) === 1;

const GALLERY_COLUMNS = Prisma.sql`i.id, i.mediaType, i.mediaUrl, i.platform, i.title, i.titleAr, i.caption, i.thumbnail, i.showOnHomepage, i.showOnTours, i.tourScope, i.isPublished, i.sortOrder, i.createdAt, i.updatedAt`;

function toPublicItem(row: GalleryRow, tourSlugs: string[]): GalleryItem {
  return {
    id: row.id,
    mediaType: row.mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE',
    mediaUrl: row.mediaUrl,
    platform: (row.platform ?? null) as GalleryItem['platform'],
    title: row.title,
    titleAr: row.titleAr,
    caption: row.caption,
    thumbnail: row.thumbnail,
    showOnHomepage: truthy(row.showOnHomepage),
    showOnTours: truthy(row.showOnTours),
    tourScope: row.tourScope === 'ALL_TOURS' ? 'ALL_TOURS' : 'SELECTED_TOURS',
    tourSlugs: [...tourSlugs].sort(),
    isPublished: truthy(row.isPublished),
    sortOrder: typeof row.sortOrder === 'bigint' ? Number(row.sortOrder) : row.sortOrder,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

async function assignmentsFor(itemIds: readonly string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!itemIds.length) return map;
  const rows = (await db.$queryRaw<Array<{ itemId: string; tourSlug: string }>>`
    SELECT itemId, tourSlug FROM journey_gallery_tours WHERE itemId IN (${Prisma.join(itemIds)}) ORDER BY tourSlug ASC`) as Array<{
    itemId: string;
    tourSlug: string;
  }>;
  for (const row of rows) {
    const list = map.get(row.itemId) ?? [];
    list.push(row.tourSlug);
    map.set(row.itemId, list);
  }
  return map;
}

async function withAssignments(rows: GalleryRow[]): Promise<GalleryItem[]> {
  const map = await assignmentsFor(rows.map((row) => row.id));
  return rows.map((row) => toPublicItem(row, map.get(row.id) ?? []));
}

function cuid(): string {
  return createHash('sha256')
    .update(`${Date.now()}:${Math.random()}:${process.pid}`)
    .digest('hex')
    .slice(0, 24);
}

export async function knownTourSlugs(): Promise<string[]> {
  const rows = await db.tour.findMany({ select: { slug: true } });
  return rows.map((row) => row.slug);
}

/** Admin list: every item with resolved assignments, stable order. */
export async function listGalleryItems(): Promise<GalleryItem[]> {
  const rows = (await db.$queryRaw<GalleryRow[]>`
    SELECT ${GALLERY_COLUMNS} FROM journey_gallery_items i ORDER BY i.sortOrder ASC, i.createdAt ASC`) as GalleryRow[];
  return withAssignments(rows);
}

/** Minimal staff-only choices; gallery managers need not have tours.view. */
export async function listGalleryTourChoices() {
  return db.tour.findMany({ orderBy: { title: 'asc' }, select: { slug: true, title: true } });
}

/** Public homepage feed: published items only (never drafts). */
export async function listPublishedGallery(): Promise<GalleryItem[]> {
  const rows = (await db.$queryRaw<GalleryRow[]>`
    SELECT ${GALLERY_COLUMNS} FROM journey_gallery_items i WHERE i.isPublished = 1 AND i.showOnHomepage = 1`) as GalleryRow[];
  return sortGalleryItems(rows.map(row => toPublicItem(row, [])));
}

/**
 * Public tour-detail feed for one tour: published videos with
 * showOnTours that are global (ALL_TOURS) or assigned to this slug.
 * Dedup is structural (one row per item).
 */
export async function listTourGalleryItems(tourSlug: string): Promise<GalleryItem[]> {
  const slug = tourSlug.trim();
  if (!slug) return [];
  const tour = await db.tour.findUnique({ where: { slug }, select: { status: true } });
  if (!tour || tour.status !== 'published') return [];
  const rows = (await db.$queryRaw<GalleryRow[]>`
    SELECT ${GALLERY_COLUMNS} FROM journey_gallery_items i
    WHERE i.mediaType = 'VIDEO' AND i.isPublished = 1 AND i.showOnTours = 1
      AND (i.tourScope = 'ALL_TOURS' OR EXISTS (
        SELECT 1 FROM journey_gallery_tours t WHERE t.itemId = i.id AND t.tourSlug = ${slug}
      ))`) as GalleryRow[];
  return sortGalleryItems(rows.map(row => toPublicItem(row, row.tourScope === 'SELECTED_TOURS' ? [slug] : [])));
}

export async function getGalleryItem(id: string): Promise<GalleryItem | null> {
  const rows = (await db.$queryRaw<GalleryRow[]>`
    SELECT ${GALLERY_COLUMNS} FROM journey_gallery_items i WHERE i.id = ${id} LIMIT 1`) as GalleryRow[];
  if (!rows.length) return null;
  const items = await withAssignments(rows);
  return items[0] ?? null;
}

export async function createGalleryItem(input: GalleryPayload): Promise<GalleryItem> {
  const slugs = await knownTourSlugs();
  const parsed = validateGalleryPayload(input, { knownTourSlugs: slugs });
  if (!parsed.ok) throw new GalleryValidationError(parsed.error);
  const value = parsed.value;
  const mediaHash = hashGalleryMediaUrl(value.mediaUrl);
  const clash = (await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM journey_gallery_items WHERE mediaHash = ${mediaHash} LIMIT 1`) as Array<{ id: string }>;
  if (clash.length) throw new GalleryValidationError('This media is already in the gallery.');

  const id = cuid();
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO journey_gallery_items
        (id, mediaType, mediaUrl, mediaHash, platform, title, titleAr, caption, thumbnail, showOnHomepage, showOnTours, tourScope, isPublished, sortOrder, createdAt, updatedAt)
      VALUES (${id}, ${value.mediaType}, ${value.mediaUrl}, ${mediaHash}, ${value.platform}, ${value.title}, ${value.titleAr}, ${value.caption}, ${value.thumbnail}, ${value.showOnHomepage ? 1 : 0}, ${value.showOnTours ? 1 : 0}, ${value.tourScope}, ${value.isPublished ? 1 : 0}, ${value.sortOrder}, NOW(3), NOW(3))`;
    for (const tourSlug of value.tourSlugs) {
      await tx.$executeRaw`
        INSERT INTO journey_gallery_tours (id, itemId, tourSlug, createdAt)
        VALUES (${cuid()}, ${id}, ${tourSlug}, NOW(3))`;
    }
  });
  const created = await getGalleryItem(id);
  if (!created) throw new GalleryValidationError('Could not save that gallery item.');
  return created;
}

export async function updateGalleryItem(id: string, input: GalleryPayload): Promise<GalleryItem> {
  const current = await getGalleryItem(id);
  if (!current) throw new GalleryNotFoundError();
  const slugs = await knownTourSlugs();
  const parsed = validateGalleryPayload(input, { knownTourSlugs: slugs });
  if (!parsed.ok) throw new GalleryValidationError(parsed.error);
  const value = parsed.value;
  const mediaHash = hashGalleryMediaUrl(value.mediaUrl);
  const clash = (await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM journey_gallery_items WHERE mediaHash = ${mediaHash} LIMIT 1`) as Array<{ id: string }>;
  if (clash.length && clash[0].id !== id) {
    throw new GalleryValidationError('This media is already in the gallery.');
  }

  // Assignments are replaced atomically: one item, one truthful set.
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM journey_gallery_tours WHERE itemId = ${id}`;
    await tx.$executeRaw`
      UPDATE journey_gallery_items SET
        mediaType = ${value.mediaType}, mediaUrl = ${value.mediaUrl}, mediaHash = ${mediaHash},
        platform = ${value.platform}, title = ${value.title}, titleAr = ${value.titleAr},
        caption = ${value.caption}, thumbnail = ${value.thumbnail},
        showOnHomepage = ${value.showOnHomepage ? 1 : 0}, showOnTours = ${value.showOnTours ? 1 : 0},
        tourScope = ${value.tourScope}, isPublished = ${value.isPublished ? 1 : 0},
        sortOrder = ${value.sortOrder}, updatedAt = NOW(3)
      WHERE id = ${id}`;
    for (const tourSlug of value.tourSlugs) {
      await tx.$executeRaw`
        INSERT INTO journey_gallery_tours (id, itemId, tourSlug, createdAt)
        VALUES (${cuid()}, ${id}, ${tourSlug}, NOW(3))`;
    }
  });
  const updated = await getGalleryItem(id);
  if (!updated) throw new GalleryNotFoundError();
  return updated;
}

/**
 * Remove an item and its tour assignments (cascade). Stored media files
 * are append-only by platform convention and are never deleted here, so
 * no other record can lose its file.
 */
export async function deleteGalleryItem(id: string): Promise<void> {
  const current = await getGalleryItem(id);
  if (!current) throw new GalleryNotFoundError();
  await db.$executeRaw`DELETE FROM journey_gallery_items WHERE id = ${id}`;
}

/** Visibility is a narrow mutation; never replace content from a stale list row. */
export async function publishGalleryItem(id: string, isPublished: boolean): Promise<GalleryItem> {
  await db.$executeRaw`UPDATE journey_gallery_items SET isPublished = ${isPublished ? 1 : 0}, updatedAt = NOW(3) WHERE id = ${id}`;
  const item = await getGalleryItem(id);
  if (!item) throw new GalleryNotFoundError();
  return item;
}

/** Atomic multi-row reorder from the admin dashboard. */
export async function reorderGalleryItems(
  order: Array<{ id: string; sortOrder: number }>,
): Promise<void> {
  if (!validateGalleryOrder(order)) throw new GalleryValidationError('Enter a non-empty order with unique IDs and integer positions from 0 to 999999 (max 500 items).');
  const clean = order;
  await db.$transaction(async (tx) => {
    const ids = [...clean.map(entry => entry.id)].sort();
    const existing = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM journey_gallery_items WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
    if (existing.length !== ids.length) throw new GalleryValidationError('Gallery changed. Refresh before reordering.');
    for (const entry of clean) {
      await tx.$executeRaw`UPDATE journey_gallery_items SET sortOrder = ${entry.sortOrder}, updatedAt = NOW(3) WHERE id = ${entry.id}`;
    }
  });
}

export class GalleryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GalleryValidationError';
  }
}

export class GalleryNotFoundError extends Error {
  constructor() {
    super('Gallery item not found.');
    this.name = 'GalleryNotFoundError';
  }
}
