'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Destination, MultiDayCategory } from '@/data/types';

/** Normalize one `/api/destinations` row to the shared domain shape. */
function toDestination(row: Record<string, unknown>): Destination {
  const detail = (row.detail ?? {}) as Record<string, unknown>;
  const strArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return {
    title: String(row.title ?? ''),
    slug: String(row.slug ?? ''),
    image: String(row.image ?? ''),
    copy: String(row.copy ?? ''),
    nameAr: typeof row.nameAr === 'string' ? row.nameAr : undefined,
    copyAr: typeof row.copyAr === 'string' ? row.copyAr : undefined,
    showInOneDayTours: row.showInOneDayTours === true ? true : undefined,
    showInDestinations: row.showInDestinations === false ? false : undefined,
    isPublished: row.isPublished === false ? false : undefined,
    displayOrder: typeof row.displayOrder === 'number' ? row.displayOrder : 999,
    detail: {
      heroImage: String(detail.heroImage ?? row.image ?? ''),
      heroAlt: String(detail.heroAlt ?? row.title ?? ''),
      eyebrow: String(detail.eyebrow ?? ''),
      intro: String(detail.intro ?? row.copy ?? ''),
      facts: Array.isArray(detail.facts) ? detail.facts : [],
      bestFor: strArray(detail.bestFor),
      experiences: Array.isArray(detail.experiences) ? detail.experiences : [],
      rhythm: Array.isArray(detail.rhythm) ? detail.rhythm : [],
      practical: Array.isArray(detail.practical) ? detail.practical : [],
      tourSlugs: strArray(detail.tourSlugs),
    },
  };
}

/** Normalize one `/api/multi-day-categories` row to the shared domain shape. */
function toCategory(row: Record<string, unknown>): MultiDayCategory {
  return {
    slug: String(row.slug ?? ''),
    name: String(row.name ?? ''),
    nameAr: String(row.nameAr ?? ''),
    copy: String(row.copy ?? ''),
    copyAr: String(row.copyAr ?? ''),
    image: String(row.image ?? ''),
    order: typeof row.order === 'number' ? row.order : 999,
    active: row.active !== false,
  };
}

type CacheEntry<T> = { list: T[] | null; inflight: Promise<T[] | null> | null; listeners: Set<() => void> };

function createCache<T>(url: string, map: (row: Record<string, unknown>) => T | null): CacheEntry<T> & { load(): void; invalidate(): void; use(base: readonly T[]): T[] } {
  const entry: CacheEntry<T> = { list: null, inflight: null, listeners: new Set() };
  const load = () => {
    if (entry.list || entry.inflight) return;
    entry.inflight = (async () => {
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) return null;
        const data = (await res.json()) as Record<string, unknown>;
        const rows = data.destinations ?? data.categories;
        if (!Array.isArray(rows) || !rows.length) return null;
        const mapped = (rows as Record<string, unknown>[])
          .map((row) => {
            try {
              return map(row);
            } catch {
              return null;
            }
          })
          .filter((v): v is T => Boolean(v));
        return mapped.length ? mapped : null;
      } catch {
        return null;
      } finally {
        entry.inflight = null;
      }
    })();
    void entry.inflight.then((list) => {
      if (list) {
        entry.list = list;
        entry.listeners.forEach((notify) => notify());
      }
    });
  };
  return {
    ...entry,
    load,
    invalidate() {
      entry.list = null;
      entry.inflight = null;
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
  };
}

const destinationsCache = createCache<Destination>('/api/destinations', (row) => {
  const item = toDestination(row);
  return item.slug ? item : null;
});

const categoriesCache = createCache<MultiDayCategory>('/api/multi-day-categories', (row) => {
  const item = toCategory(row);
  return item.slug ? item : null;
});

/**
 * Drop cached DB lists so the next read refetches. Call after any
 * successful POST/PUT/DELETE so admin + public views stay truthful.
 */
export function invalidateCatalogueCache() {
  destinationsCache.invalidate();
  categoriesCache.invalidate();
}

/**
 * Normalize free-form admin input into a DB catalogue slug
 * (lowercase letters, numbers, hyphens, max 80 chars, no prefix).
 */
export function dbSlugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * DB-backed destination list for client components (public + admin).
 * No browser storage is consulted.
 */
export function useDbDestinations(base: readonly Destination[]): Destination[] {
  return destinationsCache.use(base);
}

/**
 * DB-backed multi-day category list for client components (public + admin).
 * No browser storage is consulted.
 */
export function useDbCategories(base: readonly MultiDayCategory[]): MultiDayCategory[] {
  return categoriesCache.use(base);
}
