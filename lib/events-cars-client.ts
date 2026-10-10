'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCatalogueLanguage } from './use-catalogue-language';
import { validateCatalogueTranslations } from './catalogue-translations';
import { readJsonObject } from './json-text';
import type { Car, Event } from '@/data/types';

/** Normalize one `/api/events` row to the shared domain shape. */
export function normalizeEventRow(row: Record<string, unknown>): Event {
  const content = readJsonObject(row.content);
  const strArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return {
    translations: row.translations ? validateCatalogueTranslations('event', row.translations) : {},
    content,
    title: String(row.title ?? ''),
    titleAr: typeof row.titleAr === 'string' ? row.titleAr : undefined,
    slug: String(row.slug ?? ''),
    image: String(row.image ?? ''),
    date: String(row.date ?? ''),
    startDate: typeof row.startDate === 'string' ? row.startDate : undefined,
    endDate: typeof row.endDate === 'string' ? row.endDate : undefined,
    startTime: typeof row.startTime === 'string' ? row.startTime : undefined,
    endTime: typeof row.endTime === 'string' ? row.endTime : undefined,
    timezone: typeof row.timezone === 'string' ? row.timezone : undefined,
    location: String(row.location ?? ''),
    locationAr: typeof row.locationAr === 'string' ? row.locationAr : undefined,
    venueName: typeof row.venueName === 'string' ? row.venueName : undefined,
    venueNameAr: typeof row.venueNameAr === 'string' ? row.venueNameAr : undefined,
    address: typeof row.address === 'string' ? row.address : undefined,
    addressAr: typeof row.addressAr === 'string' ? row.addressAr : undefined,
    city: typeof row.city === 'string' ? row.city : undefined,
    cityAr: typeof row.cityAr === 'string' ? row.cityAr : undefined,
    mapQuery: typeof row.mapQuery === 'string' ? row.mapQuery : undefined,
    copy: String(row.copy ?? ''),
    copyAr: typeof row.copyAr === 'string' ? row.copyAr : undefined,
    category: typeof row.category === 'string' ? row.category : undefined,
    categoryAr: typeof row.categoryAr === 'string' ? row.categoryAr : undefined,
    featured: row.featured === true ? true : undefined,
    intro: typeof row.intro === 'string' ? row.intro : undefined,
    introAr: typeof row.introAr === 'string' ? row.introAr : undefined,
    pricingType: row.pricingType === 'free' || row.pricingType === 'paid' || row.pricingType === 'request' ? row.pricingType : undefined,
    price: typeof row.price === 'number' ? row.price : undefined,
    currency: typeof row.currency === 'string' ? row.currency : undefined,
    capacity: typeof row.capacity === 'number' ? row.capacity : undefined,
    bookingDeadline: typeof row.bookingDeadline === 'string' ? row.bookingDeadline : undefined,
    organizerName: typeof row.organizerName === 'string' ? row.organizerName : undefined,
    organizerNameAr: typeof row.organizerNameAr === 'string' ? row.organizerNameAr : undefined,
    organizerPhone: typeof row.organizerPhone === 'string' ? row.organizerPhone : undefined,
    organizerWhatsapp: typeof row.organizerWhatsapp === 'string' ? row.organizerWhatsapp : undefined,
    organizerEmail: typeof row.organizerEmail === 'string' ? row.organizerEmail : undefined,
    isPublished: row.isPublished === false ? false : undefined,
    displayOrder: typeof row.displayOrder === 'number' ? row.displayOrder : undefined,
    gallery: strArray(content.gallery),
    highlights: Array.isArray(content.highlights) ? content.highlights : undefined,
    program: Array.isArray(content.program) ? content.program : undefined,
    included: strArray(content.included),
    includedAr: strArray(content.includedAr),
    excluded: strArray(content.excluded),
    excludedAr: strArray(content.excludedAr),
    addOns: Array.isArray(content.addOns) ? content.addOns : undefined,
  } as Event;
}

/** Normalize one `/api/cars` row to the shared domain shape. */
function toCar(row: Record<string, unknown>): Car {
  const credit = (row.credit ?? null) as { label?: unknown; url?: unknown } | null;
  return {
    translations: row.translations ? validateCatalogueTranslations('car', row.translations) : {},
    title: String(row.title ?? ''),
    slug: String(row.slug ?? ''),
    image: String(row.image ?? ''),
    seats: String(row.seats ?? ''),
    transmission: String(row.transmission ?? ''),
    dailyPrice: typeof row.dailyPrice === 'number' ? row.dailyPrice : 0,
    copy: String(row.copy ?? ''),
    credit:
      credit && typeof credit.label === 'string' && typeof credit.url === 'string'
        ? { label: credit.label, url: credit.url }
        : undefined,
    isPublished: row.isPublished === false ? false : undefined,
  };
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
        if (!Array.isArray(rows)) {
          entry.error = `Unexpected response (${label}).`;
          return null;
        }
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

const eventsCache = createCache<Event>('/api/events', 'events', (row) => {
  const item = normalizeEventRow(row);
  return item.slug ? item : null;
}, 'events');

const carsCache = createCache<Car>('/api/cars', 'cars', (row) => {
  const item = toCar(row);
  return item.slug ? item : null;
}, 'cars');

/**
 * Drop cached DB lists so the next read refetches. Call after any
 * successful POST/PUT/DELETE so admin + public views stay truthful.
 */
export function invalidateEventsCarsCache() {
  eventsCache.invalidate();
  carsCache.invalidate();
}

/**
 * DB-backed event list for client components (public + admin).
 * No browser storage is consulted.
 */
export function useDbEvents(base: readonly Event[]): Event[] {
  return useCatalogueLanguage(eventsCache.use(base), 'event');
}

/**
 * DB-backed fleet list for client components (public + admin).
 * No browser storage is consulted.
 */
export function useDbCars(base: readonly Car[]): Car[] {
  return useCatalogueLanguage(carsCache.use(base), 'car');
}

/**
 * Failure-aware event list for ADMIN screens. `data` is the DB list or
 * null while loading/failed — bootstrap data is never substituted, so a
 * broken DB runtime renders loading/error instead of fake catalogue rows.
 */
export function useDbEventsStatus(): DbListStatus<Event> {
  return eventsCache.useStatus();
}

/**
 * Failure-aware fleet list for ADMIN screens. Same no-fallback contract
 * as `useDbEventsStatus`.
 */
export function useDbCarsStatus(): DbListStatus<Car> {
  return carsCache.useStatus();
}
