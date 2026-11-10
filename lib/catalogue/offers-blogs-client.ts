'use client';

import { readCampaign } from '@/lib/marketing/marketing-campaigns'

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
    campaign: readCampaign(content.campaign),
    linkedTourPublished: row.tourSlug ? (row.tour as { status?: string } | undefined)?.status === 'published' : undefined,
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
  /** DB list only  -  null until the API resolves. Never bootstrap data. */
  data: T[] | null;
  loading: boolean;
  error: string | null;
  retry(): void;
  /** Drop the cached rows and refetch from the API in place, without a
   * full page reload, so write-back screens can update the open table. */
  refresh(): void;
};

function createCache<T>(url: string, key: string, map: (row: Record<string, unknown>) => T | null, label: string): CacheEntry<T> & { load(): void; invalidate(): void; use(base: readonly T[]): T[]; useStatus(): DbListStatus<T> } {
  const entry: CacheEntry<T> = { list: null, inflight: null, listeners: new Set(), error: null };
  let generation = 0;
  let loadedAt = 0;
  // Editors keep their current snapshot until an explicit save/retry/refresh.
  const canAutoRefresh = () => !url.includes('admin=1') && !(typeof window !== 'undefined' && window.location?.pathname?.startsWith('/admin'));
  const load = (force = false) => {
    if (entry.inflight || (entry.list && !force && (!canAutoRefresh() || Date.now() - loadedAt < 30_000))) return;
    const current = generation;
    const background = entry.list !== null;
    entry.error = null;
    entry.inflight = (async () => {
      try {
        const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
        if (!res.ok) {
          if (current === generation) entry.error = `Request failed (${res.status}).`;
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
        if (current === generation) entry.error = `Could not reach the database (${label}).`;
        return null;
      } finally {
        if (current === generation) entry.inflight = null;
      }
    })();
    void entry.inflight.then((list) => {
      if (current !== generation || (background && !canAutoRefresh())) return;
      if (list) {
        entry.list = list;
        loadedAt = Date.now();
      }
      entry.listeners.forEach((notify) => notify());
    });
  };
  const foreground = () => {
    if (!canAutoRefresh()) return;
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') load(true);
  };
  const subscribe = (notify: () => void) => {
    entry.listeners.add(notify);
    const win = typeof window !== 'undefined' && typeof window.addEventListener === 'function' ? window : null;
    const doc = typeof document !== 'undefined' ? document : null;
    if (entry.listeners.size === 1 && win && doc) {
      win.addEventListener('focus', foreground);
      doc.addEventListener('visibilitychange', foreground);
    }
    return () => {
      entry.listeners.delete(notify);
      if (!entry.listeners.size && win && doc) {
        win.removeEventListener('focus', foreground);
        doc.removeEventListener('visibilitychange', foreground);
      }
    };
  };
  return {
    ...entry,
    load,
    invalidate() {
      generation++;
      entry.list = null;
      entry.inflight = null;
      entry.error = null;
      entry.listeners.forEach((notify) => notify());
      if (entry.listeners.size) load();
    },
    use(base: readonly T[]): T[] {
      // Bumped when the shared DB cache resolves so the memo below recomputes.
      const [version, setVersion] = useState(0);
      useEffect(() => {
        const notify = () => setVersion((n) => n + 1);
        const unsubscribe = subscribe(notify);
        load();
        return unsubscribe;
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
        const unsubscribe = subscribe(notify);
        load();
        return unsubscribe;
      }, []);
      return useMemo(
        () => ({
          // Admin-only: the DB list or null. Bootstrap data is NEVER
          // substituted here so a broken DB runtime cannot look healthy.
          data: entry.list,
          loading: entry.list === null && entry.error === null,
          error: entry.list === null ? entry.error : null,
          retry: () => {
            generation++;
            entry.error = null;
            entry.inflight = null;
            setVersion((n) => n + 1);
            load();
          },
          refresh: () => {
            generation++;
            entry.list = null;
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

const adminBlogsCache = createCache<Blog>('/api/blogs?admin=1', 'blogs', (row) => {
  const item = toBlog(row);
  return item.slug ? item : null;
}, 'admin blogs');

/**
 * Drop cached DB lists so the next read refetches. Call after any
 * successful POST/PUT/DELETE so admin + public views stay truthful.
 */
export function invalidateOffersBlogsCache() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('sp-marketing-offers-changed'))
  offersCache.invalidate();
  blogsCache.invalidate();
  adminBlogsCache.invalidate();
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
 * null while loading/failed  -  bootstrap data is never substituted, so a
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
  return adminBlogsCache.useStatus();
}

/** Public search must not request the private admin blog collection. */
export function usePublicBlogsStatus(): DbListStatus<Blog> {
  return blogsCache.useStatus();
}
