// Journey Gallery — shared environment-neutral domain logic.
//
// Used by client components, admin screens, API routes and unit tests.
// Pure functions only: no Node.js APIs, no Next.js imports, no Prisma,
// no `server-only`. Server persistence lives in lib/server/journey-gallery.
//
// Design notes:
// - One centralized record (`GalleryItem`) serves both the homepage rows
//   and the tour-detail video carousel. A video is NEVER duplicated per
//   tour: tour assignment is a slug list resolved from the join table.
// - Legacy content (hardcoded homepage photos, per-tour `journeyVideos`
//   JSON) is merged at read time, never rewritten, so nothing is lost.

import { VIDEO_URL_PREFIX } from './core/video-signature';

export type GalleryMediaType = 'IMAGE' | 'VIDEO';

export type GalleryPlatform =
  | 'youtube'
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'vimeo'
  | 'direct'
  | 'external';

export type GalleryTourScope = 'ALL_TOURS' | 'SELECTED_TOURS';

/** Strict server-side ceiling per uploaded video file (5 MB). */
export const MAX_GALLERY_VIDEO_BYTES = 5 * 1024 * 1024;

export const GALLERY_TITLE_MAX = 200;
export const GALLERY_CAPTION_MAX = 500;
export const GALLERY_URL_MAX = 2000;

/** Public, client-safe shape served by the gallery APIs. */
export type GalleryItem = {
  id: string;
  mediaType: GalleryMediaType;
  /** Uploaded same-origin path (`/media/...`, `/gallery-videos/...`,
   *  legacy `/...` public asset) or a normalized https social URL. */
  mediaUrl: string;
  platform: GalleryPlatform | null;
  title: string;
  titleAr?: string | null;
  caption?: string | null;
  /** Video poster / thumbnail. Null when none was provided. */
  thumbnail?: string | null;
  showOnHomepage: boolean;
  showOnTours: boolean;
  tourScope: GalleryTourScope;
  /** Resolved tour slugs from the join table (empty unless assigned). */
  tourSlugs: string[];
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type GalleryVideoSource = {
  kind: 'embed' | 'direct' | 'external';
  platform: GalleryPlatform;
  /** Embed URL, direct file URL, or external watch URL. */
  src: string;
};

const PLATFORM_LABELS: Record<GalleryPlatform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  vimeo: 'Vimeo',
  direct: 'Video',
  external: 'Video',
};

export function galleryPlatformLabel(platform: GalleryPlatform): string {
  return PLATFORM_LABELS[platform];
}

function safeHttpsUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed || /[\s<>"]/.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function hostOf(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, '');
}

export function safeGalleryLocalPath(value: string): boolean {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.startsWith('/') && !decoded.startsWith('//') && !/[\\\s<>"\u0000-\u001f]/.test(decoded) && !decoded.split(/[/?#]/).includes('..');
  } catch { return false; }
}

export function validateGalleryOrder(value: unknown): value is Array<{ id: string; sortOrder: number }> {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) return false;
  const seen = new Set<string>();
  return value.every(entry => {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id || entry.id.length > 64 || seen.has(entry.id) || !Number.isInteger(entry.sortOrder) || entry.sortOrder < 0 || entry.sortOrder > 999999) return false;
    seen.add(entry.id); return true;
  });
}

export type ParsedSocialVideo = {
  platform: Exclude<GalleryPlatform, 'direct' | 'external'>;
  /** Canonical watch URL persisted as `mediaUrl` (dedup + idempotency). */
  normalizedUrl: string;
  /** Privacy-enhanced embed URL used by the players. */
  embedSrc: string;
};

/**
 * Validate + normalize a social video URL server-side and client-side.
 * Returns null for malicious schemes, unsupported domains, arbitrary
 * embed HTML, and invalid URL formats. Only public watch URLs are
 * accepted — never embed HTML, never remote file downloads.
 */
export function parseSocialVideoUrl(value: string): ParsedSocialVideo | null {
  const url = safeHttpsUrl(value);
  if (!url) return null;
  const host = hostOf(url);
  const parts = url.pathname.split('/').filter(Boolean);

  // YouTube: watch?v=, youtu.be/, /shorts/, /embed/, /live/
  if (host === 'youtu.be') {
    const id = parts[0];
    if (id && /^[\w-]{6,}$/.test(id)) {
      return {
        platform: 'youtube',
        normalizedUrl: `https://www.youtube.com/watch?v=${id}`,
        embedSrc: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
    return null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const paramId = url.searchParams.get('v');
    const pathId =
      parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live' ? parts[1] : null;
    const id = paramId ?? pathId;
    // A watch URL must carry ONLY a plausible id (extra params tolerated,
    // anything else rejected by the strict id pattern).
    if (id && /^[\w-]{6,}$/.test(id)) {
      return {
        platform: 'youtube',
        normalizedUrl: `https://www.youtube.com/watch?v=${id}`,
        embedSrc: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
    return null;
  }

  // Instagram: reels + supported video posts only.
  if (host === 'instagram.com') {
    if ((parts[0] === 'reel' || parts[0] === 'reels' || parts[0] === 'p') && parts[1]) {
      const kind = parts[0] === 'reels' ? 'reel' : parts[0];
      const code = parts[1];
      if (!/^[\w.-]{2,64}$/.test(code)) return null;
      return {
        platform: 'instagram',
        normalizedUrl: `https://www.instagram.com/${kind}/${code}/`,
        embedSrc: `https://www.instagram.com/${kind}/${encodeURIComponent(code)}/embed/`,
      };
    }
    return null;
  }

  // Facebook: videos + reels (fb.watch short links included).
  if (host === 'facebook.com' || host === 'm.facebook.com' || host === 'fb.watch') {
    const original = url.toString();
    const isReel = parts[0] === 'reel' || parts[0] === 'reels';
    const isVideo = parts[0] === 'video' || parts[0] === 'watch' || parts.includes('videos');
    if (isReel || isVideo || host === 'fb.watch') {
      return {
        platform: 'facebook',
        normalizedUrl: original,
        embedSrc: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(original)}&show_text=false`,
      };
    }
    return null;
  }

  // TikTok: canonical /video/ links (user-scoped or short links).
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com') || host === 'vm.tiktok.com') {
    const videoIndex = parts.indexOf('video');
    const id = videoIndex >= 0 ? parts[videoIndex + 1] : null;
    if (id && /^\d{5,}$/.test(id)) {
      return {
        platform: 'tiktok',
        normalizedUrl: url.toString(),
        embedSrc: `https://www.tiktok.com/player/v1/${id}?autoplay=0`,
      };
    }
    return null;
  }

  // Vimeo: numeric video ids (legacy support — existing tour reels).
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = parts.find((part) => /^\d+$/.test(part));
    if (id) {
      return {
        platform: 'vimeo',
        normalizedUrl: `https://vimeo.com/${id}`,
        embedSrc: `https://player.vimeo.com/video/${id}`,
      };
    }
    return null;
  }

  return null;
}

/**
 * Resolve any persisted gallery/tour video URL to a safe playback source.
 * Mirrors the historical tour-video-gallery behavior so legacy per-tour
 * `journeyVideos` keep playing exactly as before.
 */
export function resolveGalleryVideoSource(
  mediaUrl: string,
  platform?: GalleryPlatform | string | null,
): GalleryVideoSource | null {
  const trimmed = mediaUrl.trim();
  // Same-origin uploads (videos) and legacy public assets always play direct.
  if (trimmed.startsWith(VIDEO_URL_PREFIX) || trimmed.startsWith('/')) {
    if (!safeGalleryLocalPath(trimmed) || !/\.(mp4|webm|ogg)(?:[?#]|$)/i.test(trimmed)) return null;
    return { kind: 'direct', platform: 'direct', src: trimmed };
  }
  const social = parseSocialVideoUrl(trimmed);
  if (social) return { kind: 'embed', platform: social.platform, src: social.embedSrc };

  const url = safeHttpsUrl(trimmed);
  if (!url) return null;
  if (/\.(mp4|webm|ogg)$/i.test(url.pathname) || platform === 'direct') {
    return { kind: 'direct', platform: 'direct', src: url.toString() };
  }
  return { kind: 'external', platform: 'external', src: url.toString() };
}

/**
 * Canonical form of a `mediaUrl` for dedup/idempotency. Social URLs use
 * their normalized watch form; everything else is trimmed as-is.
 */
export function normalizeGalleryMediaUrl(value: string): string {
  const trimmed = value.trim();
  const social = parseSocialVideoUrl(trimmed);
  return social ? social.normalizedUrl : trimmed;
}

function compareGalleryItems(a: GalleryItem, b: GalleryItem): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  const at = Date.parse(a.createdAt) || 0;
  const bt = Date.parse(b.createdAt) || 0;
  if (at !== bt) return at - bt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Stable ordering shared by every surface (sortOrder → oldest → id). */
export function sortGalleryItems(items: readonly GalleryItem[]): GalleryItem[] {
  return [...items].sort(compareGalleryItems);
}

/** Published images targeted at the homepage photo row. */
export function selectHomepagePhotos(items: readonly GalleryItem[]): GalleryItem[] {
  return sortGalleryItems(
    items.filter((item) => item.mediaType === 'IMAGE' && item.isPublished && item.showOnHomepage),
  );
}

/** Published videos targeted at the homepage video row. */
export function selectHomepageVideos(items: readonly GalleryItem[]): GalleryItem[] {
  return sortGalleryItems(
    items.filter((item) => item.mediaType === 'VIDEO' && item.isPublished && item.showOnHomepage),
  );
}

/**
 * Published videos visible on one tour-detail page: global videos plus
 * videos explicitly assigned to this tour — combined without duplicates.
 */
export function selectTourVideos(
  items: readonly GalleryItem[],
  tourSlug: string,
): GalleryItem[] {
  const slug = tourSlug.trim();
  if (!slug) return [];
  const seen = new Set<string>();
  const out: GalleryItem[] = [];
  for (const item of sortGalleryItems(items)) {
    if (item.mediaType !== 'VIDEO' || !item.isPublished || !item.showOnTours) continue;
    const visible =
      item.tourScope === 'ALL_TOURS' || item.tourSlugs.includes(slug);
    if (!visible || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export type GalleryPayload = {
  mediaType?: unknown;
  mediaUrl?: unknown;
  platform?: unknown;
  title?: unknown;
  titleAr?: unknown;
  caption?: unknown;
  thumbnail?: unknown;
  showOnHomepage?: unknown;
  showOnTours?: unknown;
  tourScope?: unknown;
  tourSlugs?: unknown;
  isPublished?: unknown;
  sortOrder?: unknown;
};

function isValidThumbnail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('/')) {
    return safeGalleryLocalPath(trimmed) && !/\.(mp4|webm|ogg)(?:[?#]|$)/i.test(trimmed);
  }
  return safeHttpsUrl(trimmed) !== null && !/\.(mp4|webm|ogg)(?:[?#]|$)/i.test(trimmed);
}

/**
 * Server-side validation for gallery create/update payloads (also reused
 * client-side for instant admin feedback). `knownTourSlugs`, when
 * provided, lets the server reject assignments to unknown tours.
 */
export function validateGalleryPayload(
  input: GalleryPayload,
  options?: { knownTourSlugs?: readonly string[] },
): { ok: true; value: NormalizedGalleryPayload } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Invalid gallery item.' };
  for (const key of ['isPublished', 'showOnHomepage', 'showOnTours'] as const) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean') return { ok: false, error: 'Visibility values must be boolean.' };
  }
  if (input.sortOrder !== undefined && input.sortOrder !== '' && (typeof input.sortOrder !== 'number' || !Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 999999)) return { ok: false, error: 'Order must be an integer from 0 to 999999.' };
  const mediaType = input.mediaType;
  if (mediaType !== 'IMAGE' && mediaType !== 'VIDEO') {
    return { ok: false, error: 'Choose whether this item is a photo or a video.' };
  }

  const rawUrl = typeof input.mediaUrl === 'string' ? input.mediaUrl.trim() : '';
  if (!rawUrl || rawUrl.length > GALLERY_URL_MAX) {
    return { ok: false, error: 'A media URL is required.' };
  }

  let platform: GalleryPlatform | null = null;
  if (mediaType === 'IMAGE') {
    // Images reuse the existing image pipeline (`/media/...`) or legacy
    // public assets (`/...`); remote https imagery is tolerated for
    // imported legacy content but never downloaded server-side.
    const isLocal = safeGalleryLocalPath(rawUrl);
    if (/\.(mp4|webm|ogg)(?:[?#]|$)/i.test(rawUrl)) return { ok: false, error: 'Choose an image, not a video.' };
    if (!isLocal && safeHttpsUrl(rawUrl) === null) {
      return { ok: false, error: 'Enter a valid image path or https URL.' };
    }
    if (input.platform !== undefined && input.platform !== null && input.platform !== '') {
      return { ok: false, error: 'Photos do not have a video platform.' };
    }
  } else {
    if (rawUrl.startsWith(VIDEO_URL_PREFIX)) {
      if (!/^\/gallery-videos\/\d{4}\/\d{2}\/[0-9a-f]{32}\.(?:mp4|webm)$/.test(rawUrl)) {
        return { ok: false, error: 'That uploaded video path is invalid.' };
      }
      platform = 'direct';
    } else if (rawUrl.startsWith('/')) {
      // Legacy direct files (e.g. existing public mp4 assets).
      if (!safeGalleryLocalPath(rawUrl) || !/\.(mp4|webm|ogg)(?:[?#]|$)/i.test(rawUrl)) {
        return { ok: false, error: 'That video path is invalid.' };
      }
      platform = 'direct';
    } else {
      const social = parseSocialVideoUrl(rawUrl);
      if (!social) {
        const direct = safeHttpsUrl(rawUrl);
        if (direct && /\.(mp4|webm|ogg)$/i.test(direct.pathname)) {
          platform = 'direct';
        } else {
          return {
            ok: false,
            error: 'Enter a supported video link (YouTube, Instagram, Facebook, TikTok) or upload an MP4/WebM file.',
          };
        }
      } else {
        platform = social.platform;
      }
    }
    // A caller-supplied platform must agree with the detected one.
    if (
      typeof input.platform === 'string' &&
      input.platform &&
      input.platform !== platform &&
      !(input.platform === 'external' && platform !== null)
    ) {
      return { ok: false, error: 'The video platform does not match the link.' };
    }
  }

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title || title.length > GALLERY_TITLE_MAX) {
    return { ok: false, error: 'Enter a title (1-200 characters).' };
  }
  const titleAr = typeof input.titleAr === 'string' && input.titleAr.trim() ? input.titleAr.trim().slice(0, GALLERY_TITLE_MAX) : null;
  const caption =
    typeof input.caption === 'string' && input.caption.trim()
      ? input.caption.trim().slice(0, GALLERY_CAPTION_MAX)
      : null;
  if (typeof input.caption === 'string' && input.caption.trim().length > GALLERY_CAPTION_MAX) {
    return { ok: false, error: 'Captions must be 500 characters or fewer.' };
  }
  const thumbnail = typeof input.thumbnail === 'string' && input.thumbnail.trim() ? input.thumbnail.trim().slice(0, GALLERY_URL_MAX) : null;
  if (thumbnail && !isValidThumbnail(thumbnail)) {
    return { ok: false, error: 'Enter a valid thumbnail path or https URL.' };
  }

  const showOnHomepage = input.showOnHomepage === true;
  const showOnTours = mediaType === 'VIDEO' && input.showOnTours === true;
  if (mediaType === 'IMAGE' && input.showOnTours === true) {
    return { ok: false, error: 'Photos can only appear in the homepage photo row.' };
  }
  if (mediaType === 'VIDEO' && !showOnHomepage && !showOnTours) {
    return { ok: false, error: 'Choose where this video appears: homepage, tour pages, or both.' };
  }

  const tourScope: GalleryTourScope = input.tourScope === 'ALL_TOURS' ? 'ALL_TOURS' : 'SELECTED_TOURS';
  let tourSlugs: string[] = [];
  if (mediaType === 'VIDEO' && showOnTours && tourScope === 'SELECTED_TOURS') {
    if (!Array.isArray(input.tourSlugs)) {
      return { ok: false, error: 'Select at least one tour for this video.' };
    }
    tourSlugs = [...new Set(input.tourSlugs.filter((s): s is string => typeof s === 'string').map((s) => s.trim()).filter(Boolean))];
    if (!tourSlugs.length) {
      return { ok: false, error: 'Select at least one tour for this video.' };
    }
    if (tourSlugs.some((s) => s.length > 80)) {
      return { ok: false, error: 'One of the selected tours is invalid.' };
    }
    if (options?.knownTourSlugs) {
      const known = new Set(options.knownTourSlugs);
      if (tourSlugs.some((s) => !known.has(s))) {
        return { ok: false, error: 'One of the selected tours no longer exists.' };
      }
    }
  }

  const isPublished = input.isPublished !== false;
  const sortOrder =
    input.sortOrder === undefined || input.sortOrder === ''
      ? 999
      : Number.isFinite(Number(input.sortOrder))
        ? Math.max(0, Math.min(999999, Math.floor(Number(input.sortOrder))))
        : 999;

  return {
    ok: true,
    value: {
      mediaType,
      mediaUrl: normalizeGalleryMediaUrl(rawUrl),
      platform,
      title,
      titleAr,
      caption,
      thumbnail,
      showOnHomepage,
      showOnTours,
      tourScope,
      tourSlugs,
      isPublished,
      sortOrder,
    },
  };
}

export type NormalizedGalleryPayload = {
  mediaType: GalleryMediaType;
  mediaUrl: string;
  platform: GalleryPlatform | null;
  title: string;
  titleAr: string | null;
  caption: string | null;
  thumbnail: string | null;
  showOnHomepage: boolean;
  showOnTours: boolean;
  tourScope: GalleryTourScope;
  tourSlugs: string[];
  isPublished: boolean;
  sortOrder: number;
};

export type LegacyJourneyVideo = {
  id: string;
  url: string;
  platform?: string | null;
  title: string;
  titleAr?: string | null;
  publishedAt: string;
  thumbnail?: string | null;
};

/**
 * Merge legacy per-tour `journeyVideos` JSON with centralized gallery
 * videos: gallery rows first (stable order), then legacy entries whose
 * normalized URL is not already covered. Nothing is dropped or rewritten.
 */
export function mergeTourVideos(
  legacy: readonly LegacyJourneyVideo[],
  gallery: readonly GalleryItem[],
): Array<{ key: string; source: GalleryVideoSource; title: string; titleAr?: string | null; date: string | null; thumbnail?: string | null }> {
  const seen = new Set<string>();
  const out: Array<{ key: string; source: GalleryVideoSource; title: string; titleAr?: string | null; date: string | null; thumbnail?: string | null }> = [];
  for (const item of gallery) {
    const source = resolveGalleryVideoSource(item.mediaUrl, item.platform);
    if (!source) continue;
    seen.add(normalizeGalleryMediaUrl(item.mediaUrl).toLowerCase());
    out.push({ key: `gallery-${item.id}`, source, title: item.title, titleAr: item.titleAr, date: item.updatedAt ?? null, thumbnail: item.thumbnail });
  }
  for (const video of legacy) {
    const source = resolveGalleryVideoSource(video.url, video.platform);
    if (!source) continue;
    const normalized = normalizeGalleryMediaUrl(video.url).toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push({ key: `legacy-${video.id}`, source, title: video.title, titleAr: video.titleAr ?? null, date: video.publishedAt ?? null, thumbnail: video.thumbnail ?? null });
  }
  return out;
}
