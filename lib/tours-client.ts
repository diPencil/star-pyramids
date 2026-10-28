'use client';

import { useEffect, useMemo, useState } from 'react';
import { decodeTourJson } from '@/lib/tour-json';
import type { Tour } from '@/data/types';
import { isTourPublished } from '@/lib/tour-publish';

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/** Map one `/api/tours?full=1` row to the shared `Tour` domain shape. */
function toTour(row: Record<string, unknown>): Tour {
  row = decodeTourJson(row)
  const priceRaw = row.price;
  const price =
    typeof priceRaw === 'number'
      ? priceRaw
      : typeof priceRaw === 'string'
        ? Number(priceRaw)
        : Number((priceRaw as { toString(): string } | null)?.toString() ?? NaN);
  return {
    slug: String(row.slug ?? ''),
    aliases: asStringArray(row.aliases),
    title: String(row.title ?? ''),
    titleAr: (row.titleAr as string | null) ?? undefined,
    category: row.category as Tour['category'],
    destinationSlug: (row.destinationSlug as string | null) ?? undefined,
    categorySlugs: asStringArray(row.categorySlugs),
    cruiseType: (row.cruiseType as Tour['cruiseType']) ?? undefined,
    departurePort: (row.departurePort as string | null) ?? undefined,
    location: String(row.location ?? ''),
    price: Number.isFinite(price) ? price : 0,
    duration: String(row.duration ?? ''),
    image: String(row.image ?? ''),
    gallery: asStringArray(row.gallery),
    galleryCaptions: (Array.isArray(row.galleryCaptions) ? row.galleryCaptions : []) as Tour['galleryCaptions'],
    journeyVideos: (Array.isArray(row.journeyVideos) ? row.journeyVideos : []) as Tour['journeyVideos'],
    photoCredits: (Array.isArray(row.photoCredits) ? row.photoCredits : []) as Tour['photoCredits'],
    summary: String(row.summary ?? ''),
    groupSize: (row.groupSize as string | null) ?? undefined,
    travelStyle: (row.travelStyle as string | null) ?? undefined,
    status: typeof row.status === 'string' ? row.status : undefined,
    manualDeal: (row.manualDeal as Tour['deal']) ?? undefined,
    deal: (row.deal as Tour['deal']) ?? undefined,
    detail: (row.detail as Tour['detail']) ?? undefined,
    dayDetail: (row.dayDetail as Tour['dayDetail']) ?? undefined,
  } as Tour;
}

/**
 * DB-backed tour list for client components.
 *
 * Fetches the authoritative catalogue (`GET /api/tours?full=1`) once and
 * shares it across mounts. The returned list preserves the `base`
 * selection: every base slug resolves to its current DB record (omitting records while loading, offline, or when a slug no
 * longer exists). Curated subsets (seasonal, popular, category lists)
 * therefore keep their shape while always showing saved DB data.
 * No browser storage is consulted.
 */
let cachedBySlug: Map<string, Tour> | null = null;
let inflight: Promise<Map<string, Tour> | null> | null = null;
let toursError: string | null = null;
let generation = 0;
const listeners = new Set<() => void>();

export type DbToursStatus = {
  /** DB-resolved list or null until the API resolves. Never silent fallback. */
  data: Tour[] | null;
  loading: boolean;
  error: string | null;
  retry(): void;
};

export async function fetchDbTours(): Promise<Map<string, Tour> | null> {
  if (cachedBySlug) return cachedBySlug;
  const current = generation;
  if (!inflight) {
    toursError = null;
    inflight = (async () => {
      try {
        const res = await fetch('/api/tours?full=1', { credentials: 'same-origin' });
        if (!res.ok) {
          if (current === generation) toursError = `Request failed (${res.status}).`;
          return null;
        }
        const data = (await res.json()) as { tours?: unknown };
        if (!Array.isArray(data.tours)) {
          if (current === generation) toursError = 'Unexpected response (tours).';
          return null;
        }
        const map = new Map<string, Tour>();
        for (const row of data.tours as Record<string, unknown>[]) {
          try {
            const tour = toTour(row);
            if (tour.slug) map.set(tour.slug, tour);
          } catch {
            // Skip malformed rows; never substitute unsaved bootstrap data.
          }
        }
        // An empty table is a truthful empty result, not a failure.
        return map;
      } catch {
        // Offline/unreachable API: leave the catalogue unavailable.
        if (current === generation) toursError = 'Could not reach the database (tours).';
        return null;
      } finally {
        if (current === generation) inflight = null;
      }
    })();
  }
  const map = await inflight;
  if (current !== generation) return null;
  if (map) {
    cachedBySlug = map;
  }
  listeners.forEach((notify) => notify());
  return map;
}

export function invalidateToursCache() {
  generation++;
  cachedBySlug = null;
  inflight = null;
  toursError = null;
  listeners.forEach((notify) => notify());
  if (listeners.size) void fetchDbTours();
}

export type DbToursOptions = {
  /**
   * Append published DB tours absent from `base` (admin-created tours with
   * new slugs), preserving base order first and title order for extras.
   * Curated surfaces (homepage seasonal/popular) keep the default `false`;
   * catalogue/listing/search/resolution surfaces pass `true`.
   */
  includeNew?: boolean;
  /** When set, only appended extras of this category are included. */
  category?: string;
};

/**
 * Pure merge: every base slug resolves only to its published DB record, DB rows with an explicit non-published
 * status are dropped, and — with `includeNew` — published DB tours absent
 * from `base` are appended. Unit-tested without a database.
 */
export function resolveTours(
  base: readonly Tour[],
  dbMap: Map<string, Tour> | null,
  options?: DbToursOptions,
): Tour[] {
  if (!dbMap) return [];
  const seen = new Set<string>();
  const out: Tour[] = [];
  for (const entry of base) {
    const live = dbMap.get(entry.slug);
    // A published-only response omits unpublished/deleted records. Never resurrect bootstrap copies.
    if (!live) continue;
    const resolved = live;
    if (!isTourPublished(resolved)) continue;
    if (seen.has(resolved.slug)) continue;
    seen.add(resolved.slug);
    out.push(resolved);
  }
  if (options?.includeNew) {
    for (const tour of dbMap.values()) {
      if (seen.has(tour.slug)) continue;
      seen.add(tour.slug);
      if (!isTourPublished(tour)) continue;
      if (options.category !== undefined && tour.category !== options.category) continue;
      out.push(tour);
    }
  }
  return out;
}

export function useDbTours(base: readonly Tour[], options?: DbToursOptions): Tour[] {
  // Bumped when the shared DB cache resolves so the memo below recomputes.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const notify = () => setVersion((n) => n + 1);
    listeners.add(notify);
    if (!cachedBySlug) void fetchDbTours();
    return () => {
      listeners.delete(notify);
    };
  }, []);
  // Referentially stable: identical `base` yields an identical result, so
  // consumers can safely depend on it in effects without render loops.
  return useMemo(() => resolveTours(base, cachedBySlug, options), [base, version, options?.includeNew, options?.category]);
}

/**
 * Failure-aware tour list for ADMIN screens. `data` stays null until the
 * API resolves; on failure `error` is set instead of silently rendering
 * bootstrap rows as if they came from the database.
 */
export function useDbToursStatus(base: readonly Tour[], options?: DbToursOptions): DbToursStatus {
  // Bumped when the shared DB cache resolves or fails.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const notify = () => setVersion((n) => n + 1);
    listeners.add(notify);
    if (!cachedBySlug) void fetchDbTours();
    return () => {
      listeners.delete(notify);
    };
  }, []);
  return useMemo(
    () => ({
      data: cachedBySlug ? resolveTours(base, cachedBySlug, options) : null,
      loading: cachedBySlug === null && toursError === null,
      error: cachedBySlug === null ? toursError : null,
      retry: () => {
        generation++;
        toursError = null;
        inflight = null;
        setVersion((n) => n + 1);
        void fetchDbTours();
      },
    }),
    [base, version, options?.includeNew, options?.category],
  );
}
