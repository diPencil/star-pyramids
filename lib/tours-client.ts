'use client';

import { useEffect, useState } from 'react';
import type { Tour } from '@/data/types';

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/** Map one `/api/tours?full=1` row to the shared `Tour` domain shape. */
function toTour(row: Record<string, unknown>): Tour {
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
 * selection: every base slug resolves to its current DB record (falling
 * back to the bootstrap entry while loading, offline, or when a slug no
 * longer exists). Curated subsets (seasonal, popular, category lists)
 * therefore keep their shape while always showing saved DB data.
 * No browser storage is consulted.
 */
let cachedBySlug: Map<string, Tour> | null = null;
let inflight: Promise<Map<string, Tour> | null> | null = null;
const listeners = new Set<() => void>();

async function fetchDbTours(): Promise<Map<string, Tour> | null> {
  if (cachedBySlug) return cachedBySlug;
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch('/api/tours?full=1', { credentials: 'same-origin' });
        if (!res.ok) return null;
        const data = (await res.json()) as { tours?: unknown };
        if (!Array.isArray(data.tours) || !data.tours.length) return null;
        const map = new Map<string, Tour>();
        for (const row of data.tours as Record<string, unknown>[]) {
          try {
            const tour = toTour(row);
            if (tour.slug) map.set(tour.slug, tour);
          } catch {
            // Skip malformed rows; keep rendering the bootstrap entry.
          }
        }
        return map.size ? map : null;
      } catch {
        // Offline/unreachable API: keep rendering the bootstrap catalogue.
        return null;
      } finally {
        inflight = null;
      }
    })();
  }
  const map = await inflight;
  if (map) {
    cachedBySlug = map;
    listeners.forEach((notify) => notify());
  }
  return map;
}

export function useDbTours(base: readonly Tour[]): Tour[] {
  const [, force] = useState(0);
  useEffect(() => {
    if (cachedBySlug) return;
    const notify = () => force((n) => n + 1);
    listeners.add(notify);
    void fetchDbTours();
    return () => {
      listeners.delete(notify);
    };
  }, []);
  if (!cachedBySlug) return [...base];
  return base.map((entry) => cachedBySlug!.get(entry.slug) ?? entry);
}
