'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  mergeTourVideos,
  selectHomepagePhotos,
  selectHomepageVideos,
  selectTourVideos,
  type GalleryItem,
  type LegacyJourneyVideo,
} from '@/lib/journey-gallery';

type GalleryFeed = { items?: unknown; unavailable?: boolean };

function asGalleryItems(value: unknown): GalleryItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is GalleryItem =>
      !!row &&
      typeof row === 'object' &&
      typeof (row as GalleryItem).id === 'string' &&
      typeof (row as GalleryItem).mediaUrl === 'string' &&
      ((row as GalleryItem).mediaType === 'IMAGE' || (row as GalleryItem).mediaType === 'VIDEO'),
  );
}

let homepageCache: GalleryItem[] | null = null;
let homepageInflight: Promise<GalleryItem[]> | null = null;
const tourCache = new Map<string, GalleryItem[]>();
const tourInflight = new Map<string, Promise<GalleryItem[]>>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

async function fetchFeed(url: string): Promise<GalleryItem[]> {
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return [];
    const data = (await res.json()) as GalleryFeed;
    return asGalleryItems(data.items);
  } catch {
    return [];
  }
}

function fetchHomepage(): Promise<GalleryItem[]> {
  if (homepageCache) return Promise.resolve(homepageCache);
  if (!homepageInflight) {
    homepageInflight = fetchFeed('/api/journey-gallery').then((items) => {
      homepageCache = items;
      homepageInflight = null;
      notify();
      return items;
    });
  }
  return homepageInflight;
}

function fetchTourFeed(tourSlug: string): Promise<GalleryItem[]> {
  const cached = tourCache.get(tourSlug);
  if (cached) return Promise.resolve(cached);
  const inflight = tourInflight.get(tourSlug);
  if (inflight) return inflight;
  const pending = fetchFeed(`/api/journey-gallery?tour=${encodeURIComponent(tourSlug)}`).then(
    (items) => {
      tourCache.set(tourSlug, items);
      tourInflight.delete(tourSlug);
      notify();
      return items;
    },
  );
  tourInflight.set(tourSlug, pending);
  return pending;
}

export function invalidateJourneyGalleryCache() {
  homepageCache = null;
  homepageInflight = null;
  tourCache.clear();
  tourInflight.clear();
}

function useGalleryVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const fn = () => setVersion((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return version;
}

/**
 * DB-driven homepage rows. While loading (or when the gallery tables are
 * unavailable), both lists are empty so the caller renders its legacy
 * photo fallback — existing content is never blanked by a failed fetch.
 */
export function useHomepageGallery(): { photos: GalleryItem[]; videos: GalleryItem[] } {
  const version = useGalleryVersion();
  useEffect(() => {
    if (!homepageCache) void fetchHomepage();
  }, []);
  return useMemo(() => {
    const items = homepageCache ?? [];
    return { photos: selectHomepagePhotos(items), videos: selectHomepageVideos(items) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
}

/**
 * Centralized gallery videos for one tour page, merged with the tour's
 * legacy `journeyVideos` JSON (dedup by normalized URL, gallery first).
 */
export function useTourGalleryVideos(
  tourSlug: string,
  legacy: readonly LegacyJourneyVideo[] = [],
): GalleryItem[] {
  const version = useGalleryVersion();
  useEffect(() => {
    if (tourSlug && !tourCache.has(tourSlug)) void fetchTourFeed(tourSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourSlug]);
  return useMemo(() => {
    if (!tourSlug) return [];
    return selectTourVideos(tourCache.get(tourSlug) ?? [], tourSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourSlug, version, legacy]);
}

export type MergedTourVideo = ReturnType<typeof mergeTourVideos>[number];

/** Gallery-first merge of centralized videos with legacy tour videos. */
export function useMergedTourVideos(
  gallery: readonly GalleryItem[],
  legacy: readonly LegacyJourneyVideo[] = [],
): MergedTourVideo[] {
  return useMemo(() => mergeTourVideos(legacy, gallery), [gallery, legacy]);
}
