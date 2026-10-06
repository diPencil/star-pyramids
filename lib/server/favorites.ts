// Favorites domain service (Phase 2G). Server owns the saved-trip
// set: listing, membership checks, adds, and removals for the
// authenticated customer. The browser supplies a catalogue key ONLY
// (item type + slug) — never titles, images, prices, ownership, or
// display data. Saved rows resolve live against the catalogue, so
// catalogue copy or price changes never stale the saved set.
import 'server-only';

import { Prisma } from '@prisma/client';

import { db } from './db';
import { findTour } from '@/data/tours';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 120;

/** Supported saved-item types. Only catalogue tours exist today. */
const ITEM_TYPES = new Set(['tour']);

export interface ValidatedFavorite {
  itemType: string;
  itemSlug: string;
}

/**
 * Strict server validation of favorite input. Unknown catalogue keys
 * and unsupported types are rejected — never persisted.
 */
export function validateFavorite(input: unknown): ValidatedFavorite {
  if (typeof input !== 'object' || input === null) throw new Error('Invalid request.');
  const body = input as Record<string, unknown>;
  const itemType = typeof body.itemType === 'string' && body.itemType !== '' ? body.itemType : 'tour';
  if (!ITEM_TYPES.has(itemType)) throw new Error('Unsupported saved item.');
  const rawSlug = body.slug ?? body.itemSlug;
  const itemSlug = typeof rawSlug === 'string' ? rawSlug.trim() : '';
  if (!SLUG_PATTERN.test(itemSlug) || itemSlug.length > MAX_SLUG_LENGTH) {
    throw new Error('Select a valid trip.');
  }
  if (!findTour(itemSlug)) {
    throw new Error('This trip is no longer available.');
  }
  return { itemType, itemSlug };
}

/** Newest-first saved slugs for the customer. Empty when none. */
export async function listFavoriteSlugs(userId: string): Promise<string[]> {
  const rows = await db.favoriteItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { itemSlug: true },
  });
  return rows.map((row) => row.itemSlug);
}

export async function isFavorite(
  userId: string,
  itemSlug: string,
): Promise<boolean> {
  const row = await db.favoriteItem.findUnique({
    where: { userId_itemType_itemSlug: { userId, itemType: 'tour', itemSlug } },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Save one catalogue item. Re-saving resolves to the existing row
 * instead of creating a duplicate (the unique constraint is the
 * backstop; the pre-check keeps the response honest).
 */
export async function addFavorite(
  userId: string,
  input: ValidatedFavorite,
): Promise<string[]> {
  const existing = await db.favoriteItem.findUnique({
    where: {
      userId_itemType_itemSlug: { userId, itemType: input.itemType, itemSlug: input.itemSlug },
    },
    select: { id: true },
  });
  if (!existing) {
    try {
      await db.favoriteItem.create({
        data: { userId, itemType: input.itemType, itemSlug: input.itemSlug },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
      // Unique-race: another request won — fall through to the list.
    }
  }
  return listFavoriteSlugs(userId);
}

/**
 * Remove one saved item. Removing a non-saved item succeeds with the
 * current list — removal is idempotent by design.
 */
export async function removeFavorite(
  userId: string,
  input: ValidatedFavorite,
): Promise<string[]> {
  await db.favoriteItem.deleteMany({
    where: { userId, itemType: input.itemType, itemSlug: input.itemSlug },
  });
  return listFavoriteSlugs(userId);
}
