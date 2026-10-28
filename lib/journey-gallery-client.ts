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

let generation = 0;
let homepageError = false;
let homepageCache: GalleryItem[] | null = null;
let homepageInflight: Promise<GalleryItem[]> | null = null;
const tourCache = new Map<string, GalleryItem[]>();
const tourInflight = new Map<string, Promise<GalleryItem[]>>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

async function fetchFeed(url: string): Promise<GalleryItem[]> {
  try {
    const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) throw new Error('Gallery unavailable');
    const data = (await res.json()) as GalleryFeed;
    if (data.unavailable || !Array.isArray(data.items)) throw new Error('Gallery unavailable');
    return asGalleryItems(data.items);
  } catch { throw new Error('Gallery unavailable'); }
}

export function fetchHomepage(): Promise<GalleryItem[]> {
  if (homepageCache) return Promise.resolve(homepageCache);
  if (!homepageInflight) {
    const current = generation;
    const pending = fetchFeed('/api/journey-gallery').then(items => {
      if (current === generation) { homepageCache = items; homepageError = false; }
      return items;
    }).catch(() => { if (current === generation) homepageError = true; return []; }).finally(() => {
      if (homepageInflight === pending) homepageInflight = null;
      if (current === generation) notify();
    });
    homepageInflight = pending;
  }
  return homepageInflight;
}

function fetchTourFeed(tourSlug: string): Promise<GalleryItem[]> {
  const cached = tourCache.get(tourSlug);
  if (cached) return Promise.resolve(cached);
  const inflight = tourInflight.get(tourSlug);
  if (inflight) return inflight;
  const current = generation;
  const pending = fetchFeed(`/api/journey-gallery?tour=${encodeURIComponent(tourSlug)}`).then(
    (items) => {
      if (current !== generation) return [];
      tourCache.set(tourSlug, items);
      tourInflight.delete(tourSlug);
      notify();
      return items;
    },
  ).catch(() => { if (current === generation) tourInflight.delete(tourSlug); return []; });
  tourInflight.set(tourSlug, pending);
  return pending;
}

export function invalidateJourneyGalleryCache() {
  generation++;
  homepageError = false;
  homepageCache = null;
  homepageInflight = null;
  tourCache.clear();
  tourInflight.clear();
  notify();
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
 * DB-driven homepage rows with explicit loading/error/retry state.
 * A failed fetch is never cached as a successful empty gallery.
 */
export function useHomepageGallery(): { photos: GalleryItem[]; videos: GalleryItem[]; loading: boolean; error: boolean; retry: () => void } {
  const version = useGalleryVersion();
  useEffect(() => {
    if (!homepageCache && !homepageError) void fetchHomepage();
  }, [version]);
  return useMemo(() => {
    const items = homepageCache ?? [];
    return { photos: selectHomepagePhotos(items), videos: selectHomepageVideos(items), loading: homepageCache === null && !homepageError, error: homepageError, retry: invalidateJourneyGalleryCache };
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
  }, [tourSlug, version]);
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
