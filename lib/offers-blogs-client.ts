'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCatalogueLanguage } from './use-catalogue-language';
import { validateCatalogueTranslations } from './catalogue-translations';
import type { Blog, Offer } from '@/data/types';

/** Normalize one `/api/offers` row to the shared domain shape. */
function toOffer(row: Record<string, unknown>): Offer {
  const content = (row.content ?? {}) as Record<string, unknown>;
  const strArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  const gallery = strArray(content.gallery);
  const highlights = strArray(content.highlights);
  return {
    tourSlug: typeof row.tourSlug === 'string' ? row.tourSlug : undefined,
    discountPercent: typeof row.discountPercent === 'number' ? row.discountPercent : undefined,
    startsAt: typeof row.startsAt === 'string' ? row.startsAt : undefined,
    translations: row.translations ? validateCatalogueTranslations('offer', row.translations) : {},
    title: String(row.title ?? ''),
    slug: String(row.slug ?? ''),
    image: String(row.image ?? ''),
    gallery: gallery.length ? gallery : undefined,
    photoCredits: Array.isArray(content.photoCredits) ? content.photoCredits : undefined,
    badge: String(row.badge ?? ''),
    copy: String(row.copy ?? ''),
    highlights: highlights.length ? highlights : undefined,
    duration: typeof row.duration === 'string' ? row.duration : undefined,
    rating: typeof row.rating === 'number' ? row.rating : undefined,
    price: typeof row.price === 'number' ? row.price : undefined,
    originalPrice: typeof row.originalPrice === 'number' ? row.originalPrice : undefined,
    deadline: typeof row.deadline === 'string' ? row.deadline : undefined,
    isPublished: row.isPublished === false ? false : undefined,
    displayOrder: typeof row.displayOrder === 'number' ? row.displayOrder : undefined,
  } as Offer;
}

/** Normalize one `/api/blogs` row to the shared domain shape. */
function toBlog(row: Record<string, unknown>): Blog {
  const content = (row.content ?? {}) as Record<string, unknown>;
  return {
    translations: row.translations ? validateCatalogueTranslations('blog', row.translations) : {},
    title: String(row.title ?? ''),
    slug: String(row.slug ?? ''),
    image: String(row.image ?? ''),
    category: String(row.category ?? ''),
    date: String(row.date ?? ''),
    excerpt: String(row.excerpt ?? ''),
    editorial: (content.editorial as Blog['editorial']) ?? undefined,
    isPublished: row.isPublished === false ? false : undefined,
    displayOrder: typeof row.displayOrder === 'number' ? row.displayOrder : undefined,
  } as Blog;
}

type CacheEntry<T> = { list: T[] | null; inflight: Promise<T[] | null> | null; listeners: Set<() => void>; error: string | null };

export type DbListStatus<T> = {
  /** DB list only — null until the API resolves. Never bootstrap data. */
  data: T[] | null;
  loading: boolean;
  error: string | null;
  retry(): void;
};

function createCache<T>(url: string, key: string, map: (row: Record<string, unknown>) => T | null, label: string): CacheEntry<T> & { load(): void; invalidate(): void; use(base: readonly T[]): T[]; useStatus(): DbListStatus<T> } {
  const entry: CacheEntry<T> = { list: null, inflight: null, listeners: new Set(), error: null };
  const load = () => {
    if (entry.list || entry.inflight) return;
    entry.error = null;
    entry.inflight = (async () => {
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) {
          entry.error = `Request failed (${res.status}).`;
          return null;
        }
        const data = (await res.json()) as Record<string, unknown>;
        const rows = data[key];
        if (!Array.isArray(rows)) throw Error('Invalid catalogue response.');
        const mapped = (rows as Record<string, unknown>[])
          .map((row) => {
            try {
              return map(row);
            } catch {
              return null;
            }
          })
          .filter((v): v is T => Boolean(v));
        // An empty table is a truthful empty list, not a failure.
        return mapped;
      } catch {
        entry.error = `Could not reach the database (${label}).`;
        return null;
      } finally {
        entry.inflight = null;
      }
    })();
    void entry.inflight.then((list) => {
      if (list) {
        entry.list = list;
      }
      entry.listeners.forEach((notify) => notify());
    });
  };
  return {
    ...entry,
    load,
    invalidate() {
      entry.list = null;
      entry.inflight = null;
      entry.error = null;
    },
    use(base: readonly T[]): T[] {
      // Bumped when the shared DB cache resolves so the memo below recomputes.
      const [version, setVersion] = useState(0);
      useEffect(() => {
        if (entry.list) return;
        const notify = () => setVersion((n) => n + 1);
        entry.listeners.add(notify);
        load();
        return () => {
          entry.listeners.delete(notify);
        };
      }, []);
      // Referentially stable: identical `base` yields an identical result,
      // so consumers can safely depend on it in effects without render
      // loops. Full DB list wins (admin creates new slugs outside the
      // bootstrap set); the bootstrap catalogue renders until it arrives.
      return useMemo(() => entry.list ?? [...base], [base, version]);
    },
    useStatus(): DbListStatus<T> {
      // Bumped when the shared DB cache resolves or fails.
      const [version, setVersion] = useState(0);
      useEffect(() => {
        const notify = () => setVersion((n) => n + 1);
        entry.listeners.add(notify);
        load();
        return () => {
          entry.listeners.delete(notify);
        };
      }, []);
      return useMemo(
        () => ({
          // Admin-only: the DB list or null. Bootstrap data is NEVER
          // substituted here so a broken DB runtime cannot look healthy.
          data: entry.list,
          loading: entry.list === null && entry.error === null,
          error: entry.list === null ? entry.error : null,
          retry: () => {
            entry.error = null;
            entry.inflight = null;
            setVersion((n) => n + 1);
            load();
          },
        }),
        [version],
      );
    },
  };
}

const offersCache = createCache<Offer>('/api/offers', 'offers', (row) => {
  const item = toOffer(row);
  return item.slug ? item : null;
}, 'offers');

const blogsCache = createCache<Blog>('/api/blogs', 'blogs', (row) => {
  const item = toBlog(row);
  return item.slug ? item : null;
}, 'blogs');

/**
 * Drop cached DB lists so the next read refetches. Call after any
 * successful POST/PUT/DELETE so admin + public views stay truthful.
 */
export function invalidateOffersBlogsCache() {
  offersCache.invalidate();
  blogsCache.invalidate();
}

/**
 * DB-backed offer list for client components (public + admin).
 * No browser storage is consulted.
 */
export function useDbOffers(base: readonly Offer[]): Offer[] {
  return useCatalogueLanguage(offersCache.use(base), 'offer');
}

/**
 * DB-backed blog list for client components (public + admin).
 * No browser storage is consulted.
 */
export function useDbBlogs(base: readonly Blog[]): Blog[] {
  return useCatalogueLanguage(blogsCache.use(base), 'blog');
}

/**
 * Failure-aware offer list for ADMIN screens. `data` is the DB list or
 * null while loading/failed — bootstrap data is never substituted, so a
 * broken DB runtime renders loading/error instead of fake catalogue rows.
 */
export function useDbOffersStatus(): DbListStatus<Offer> {
  return offersCache.useStatus();
}

/**
 * Failure-aware blog list for ADMIN screens. Same no-fallback contract
 * as `useDbOffersStatus`.
 */
export function useDbBlogsStatus(): DbListStatus<Blog> {
  return blogsCache.useStatus();
}
