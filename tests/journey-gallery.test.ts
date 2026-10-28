// STAR PYRAMIDS — Unified Journey Gallery regression suite.
//
// Database-independent: pure domain logic (lib/journey-gallery.ts,
// lib/core/video-signature.ts) plus source-level guards pinning the
// preserved homepage marquee mechanics, the tour carousel behavior, API
// permission conventions, and legacy-content preservation. No database
// is touched; `prisma migrate` is never executed here.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  MAX_GALLERY_VIDEO_BYTES,
  galleryPlatformLabel,
  mergeTourVideos,
  normalizeGalleryMediaUrl,
  parseSocialVideoUrl,
  resolveGalleryVideoSource,
  selectHomepagePhotos,
  selectHomepageVideos,
  selectTourVideos,
  sortGalleryItems,
  validateGalleryPayload,
  type GalleryItem,
} from '@/lib/journey-gallery';
import {
  VIDEO_STORAGE_KEY_PATTERN,
  VIDEO_URL_PREFIX,
  detectVideoFormat,
  isVideoStorageKey,
} from '@/lib/core/video-signature';
import { MEDIA_STORAGE_KEY_PATTERN, detectImageFormat } from '@/lib/core/media-signature';

const read = (path: string) => readFileSync(join(process.cwd(), ...path.split('/')), 'utf8');

const item = (overrides: Partial<GalleryItem> & { id: string }): GalleryItem => ({
  mediaType: 'VIDEO',
  mediaUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  platform: 'youtube',
  title: `Title ${overrides.id}`,
  titleAr: null,
  caption: null,
  thumbnail: null,
  showOnHomepage: false,
  showOnTours: false,
  tourScope: 'SELECTED_TOURS',
  tourSlugs: [],
  isPublished: true,
  sortOrder: 999,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('social video URL validation', () => {
  it('accepts YouTube watch, short, and Shorts URLs with a canonical form', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    ]) {
      const parsed = parseSocialVideoUrl(url);
      expect(parsed?.platform).toBe('youtube');
      expect(parsed?.normalizedUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(parsed?.embedSrc).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//);
    }
  });

  it('accepts Instagram reels/posts, Facebook videos/reels, and TikTok videos', () => {
    expect(parseSocialVideoUrl('https://www.instagram.com/reel/ABC123xyz/')?.platform).toBe('instagram');
    expect(parseSocialVideoUrl('https://www.instagram.com/p/ABC123xyz/')?.platform).toBe('instagram');
    expect(parseSocialVideoUrl('https://www.facebook.com/watch/?v=123456789')?.platform).toBe('facebook');
    expect(parseSocialVideoUrl('https://www.facebook.com/reel/123456789')?.platform).toBe('facebook');
    expect(parseSocialVideoUrl('https://www.tiktok.com/@user/video/1234567890123456789')?.platform).toBe('tiktok');
  });

  it('rejects malicious schemes, unsupported domains, embed HTML, and non-video pages', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,<iframe></iframe>',
      'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://evil.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.evil.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/',
      'https://www.youtube.com/results?search_query=egypt',
      'https://www.instagram.com/someuser/',
      'https://www.facebook.com/some-page',
      '<iframe src="https://www.youtube.com/embed/x"></iframe>',
      'not a url',
      '',
      'https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ',
    ]) {
      expect(parseSocialVideoUrl(url), url).toBeNull();
    }
  });

  it('normalizes equivalent links to one identity for dedup', () => {
    expect(normalizeGalleryMediaUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
      normalizeGalleryMediaUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    );
  });
});

describe('video source resolution (safe playback)', () => {
  it('plays uploaded and legacy local files direct, never as embeds', () => {
    expect(resolveGalleryVideoSource('/gallery-videos/2026/10/abcdef0123456789abcdef0123456789.mp4', 'direct')?.kind).toBe('direct');
    expect(resolveGalleryVideoSource('/media/2026/10/abcdef0123456789abcdef0123456789.jpg', null)).toBeNull();
  });

  it('rejects traversal and inline markup in local paths', () => {
    expect(resolveGalleryVideoSource('/gallery-videos/../secret.mp4', 'direct')).toBeNull();
    expect(resolveGalleryVideoSource('/x/<script>.mp4', null)).toBeNull();
  });

  it('falls back to an external watch link when embedding is restricted', () => {
    const source = resolveGalleryVideoSource('https://example.com/videos/trip-1', null);
    expect(source?.kind).toBe('external');
    expect(source?.src).toBe('https://example.com/videos/trip-1');
  });
});

describe('upload limits and content validation', () => {
  it('caps uploaded videos at exactly 5 MB', () => {
    expect(MAX_GALLERY_VIDEO_BYTES).toBe(5 * 1024 * 1024);
  });

  it('detects MP4/WebM from magic bytes and rejects images and executables', () => {
    const mp4 = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42, 0x82]);
    expect(detectVideoFormat(mp4)).toBe('mp4');
    expect(detectVideoFormat(webm)).toBe('webm');
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectVideoFormat(png)).toBeNull();
    expect(detectImageFormat(mp4)).toBeNull();
    expect(detectVideoFormat(new TextEncoder().encode('MZ executable'))).toBeNull();
    expect(detectVideoFormat(new Uint8Array(0))).toBeNull();
  });

  it('keeps video and image storage namespaces disjoint', () => {
    const videoKey = '2026/10/abcdef0123456789abcdef0123456789.mp4';
    expect(isVideoStorageKey(videoKey)).toBe(true);
    expect(VIDEO_STORAGE_KEY_PATTERN.test(videoKey)).toBe(true);
    expect(MEDIA_STORAGE_KEY_PATTERN.test(videoKey)).toBe(false);
    expect(VIDEO_URL_PREFIX).toBe('/gallery-videos/');
  });

  it('enforces the client + server 5 MB ceiling in the media route', () => {
    const route = read('app/api/media/route.ts');
    expect(route).toMatch(/MAX_GALLERY_VIDEO_BYTES/);
    expect(route).toMatch(/Videos must be 5 MB or smaller/);
    expect(route).toMatch(/gallery-video/);
  });
});

describe('homepage row filtering', () => {
  const photos = [
    item({ id: 'p1', mediaType: 'IMAGE', mediaUrl: '/media/2026/10/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg', platform: null, showOnHomepage: true, sortOrder: 20 }),
    item({ id: 'p2', mediaType: 'IMAGE', mediaUrl: '/media/2026/10/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg', platform: null, showOnHomepage: true, sortOrder: 10 }),
    item({ id: 'p3', mediaType: 'IMAGE', mediaUrl: '/media/2026/10/cccccccccccccccccccccccccccccccc.jpg', platform: null, showOnHomepage: true, sortOrder: 30, isPublished: false }),
  ];
  const videos = [
    item({ id: 'v1', showOnHomepage: true, sortOrder: 5 }),
    item({ id: 'v2', showOnHomepage: false, showOnTours: true, tourScope: 'ALL_TOURS' }),
  ];

  it('renders published homepage photos in stable order, hiding drafts', () => {
    expect(selectHomepagePhotos([...photos, ...videos]).map((i) => i.id)).toEqual(['p2', 'p1']);
  });

  it('renders only videos targeted at the homepage video row', () => {
    expect(selectHomepageVideos([...photos, ...videos]).map((i) => i.id)).toEqual(['v1']);
  });

  it('orders by sortOrder, then oldest, then id', () => {
    const a = item({ id: 'b', showOnHomepage: true, sortOrder: 1, createdAt: '2026-02-01T00:00:00.000Z' });
    const b = item({ id: 'a', showOnHomepage: true, sortOrder: 1, createdAt: '2026-01-01T00:00:00.000Z' });
    expect(sortGalleryItems([a, b]).map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('tour-page visibility and assignment', () => {
  const global = item({ id: 'g', showOnTours: true, tourScope: 'ALL_TOURS', sortOrder: 1 });
  const assigned = item({
    id: 's', mediaUrl: 'https://www.instagram.com/reel/ABC123xyz/', platform: 'instagram',
    showOnTours: true, tourScope: 'SELECTED_TOURS', tourSlugs: ['cairo-day', 'luxor-day'], sortOrder: 2,
  });
  const other = item({
    id: 'o', mediaUrl: 'https://www.tiktok.com/@u/video/1234567890123456789', platform: 'tiktok',
    showOnTours: true, tourScope: 'SELECTED_TOURS', tourSlugs: ['aswan-day'], sortOrder: 3,
  });
  const homepageOnly = item({ id: 'h', showOnHomepage: true, sortOrder: 0 });
  const draft = item({ id: 'd', mediaUrl: 'https://youtu.be/AAAAAAAAAAAAAAAAAAA', showOnTours: true, tourScope: 'ALL_TOURS', isPublished: false });

  it('shows global videos on every tour and assigned videos only on their tours', () => {
    expect(selectTourVideos([global, assigned, other, homepageOnly, draft], 'cairo-day').map((i) => i.id)).toEqual(['g', 's']);
    expect(selectTourVideos([global, assigned, other, homepageOnly, draft], 'aswan-day').map((i) => i.id)).toEqual(['g', 'o']);
    expect(selectTourVideos([global, assigned, other, homepageOnly, draft], 'unknown-tour').map((i) => i.id)).toEqual(['g']);
  });

  it('never duplicates one video assigned to multiple tours', () => {
    const multi = item({
      id: 'm', mediaUrl: 'https://youtu.be/BBBBBBBBBBB', showOnTours: true,
      tourScope: 'SELECTED_TOURS', tourSlugs: ['a', 'b', 'c'],
    });
    for (const slug of ['a', 'b', 'c']) {
      const ids = selectTourVideos([multi], slug).map((i) => i.id);
      expect(ids).toEqual(['m']);
    }
  });

  it('merges gallery rows with legacy tour videos without duplicates, gallery first', () => {
    const legacy = [
      { id: 'l1', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Legacy same video', publishedAt: '2026-03-01' },
      { id: 'l2', url: 'https://www.facebook.com/reel/999', title: 'Legacy extra', publishedAt: '2026-02-01' },
    ];
    const merged = mergeTourVideos(legacy, [global]);
    expect(merged[0].key).toBe('gallery-g');
    expect(merged.map((m) => m.key)).toEqual(['gallery-g', 'legacy-l2']);
    expect(merged[1].source.kind).toBe('embed');
  });

  it('keeps every legacy video when no gallery rows exist', () => {
    const legacy = [{ id: 'l1', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Legacy', publishedAt: '2026-03-01' }];
    expect(mergeTourVideos(legacy, []).map((m) => m.key)).toEqual(['legacy-l1']);
  });
});

describe('admin payload validation', () => {
  const baseVideo = {
    mediaType: 'VIDEO',
    mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
    title: 'Nile sunset',
    showOnHomepage: true,
    showOnTours: true,
    tourScope: 'SELECTED_TOURS',
    tourSlugs: ['cairo-day'],
  };

  it('accepts a valid video for both surfaces and normalizes its URL', () => {
    const result = validateGalleryPayload(baseVideo, { knownTourSlugs: ['cairo-day'] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.platform).toBe('youtube');
      expect(result.value.mediaUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    }
  });

  it('rejects invalid display-target combinations', () => {
    expect(validateGalleryPayload({ mediaType: 'IMAGE', mediaUrl: '/a.jpg', title: 'T', showOnTours: true }).ok).toBe(false);
    expect(validateGalleryPayload({ mediaType: 'VIDEO', mediaUrl: 'https://youtu.be/dQw4w9WgXcQ', title: 'T' }).ok).toBe(false);
    expect(validateGalleryPayload({ ...baseVideo, tourSlugs: [] }).ok).toBe(false);
    expect(validateGalleryPayload({ ...baseVideo, tourSlugs: ['ghost-tour'] }, { knownTourSlugs: ['cairo-day'] }).ok).toBe(false);
    expect(validateGalleryPayload({ ...baseVideo, title: '  ' }).ok).toBe(false);
    expect(validateGalleryPayload({ ...baseVideo, mediaUrl: 'https://evil.com/v/1' }).ok).toBe(false);
  });

  it('requires ALL_TOURS videos to carry no assignments and dedupes slugs', () => {
    const result = validateGalleryPayload({ ...baseVideo, tourScope: 'ALL_TOURS', tourSlugs: ['a', 'a', 'b'] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.tourSlugs).toEqual([]);
  });
});

describe('preserved animation and carousel behavior (source guards)', () => {
  const homepage = read('components/homepage.tsx');
  const css = read('app/globals.css');
  const tourGallery = read('components/tour-video-gallery.tsx');

  it('keeps two independently animated marquee rows with original directions and speeds', () => {
    expect(homepage).toMatch(/className="gal-marquee"/);
    expect(homepage).toMatch(/gal-track/);
    expect(homepage).toMatch(/video\?' rev'/);
    expect(css).toMatch(/\.gal-track\{[^}]*animation:hlScroll 46s linear infinite\}/);
    expect(css).toMatch(/\.gal-track\.rev\{[^}]*animation:hlScrollRev 52s linear infinite\}/);
    expect(css).toMatch(/@keyframes hlScroll\{to\{transform:translateX\(-50%\)\}\}/);
    expect(css).toMatch(/@keyframes hlScrollRev\{from\{transform:translateX\(-50%\)\}to\{transform:none\}\}/);
    expect(css).toMatch(/\.gal-track\.is-paused/);
  });

  it('pauses the video row while playback is active and never autoplays sound', () => {
    expect(homepage).toMatch(/is-paused/);
    expect(read('components/gallery-lightbox.tsx')).toMatch(/role="dialog" aria-modal="true"/);
    expect(homepage).not.toMatch(/autoPlay/);
  });

  it('keeps the tour-detail carousel controls, platform labels, and placement', () => {
    expect(tourGallery).toMatch(/HorizontalSlider/);
    expect(tourGallery).toMatch(/className="tour-video-track"/);
    expect(tourGallery).toMatch(/tour-video-platform/);
    expect(tourGallery).toMatch(/previousLabel/);
    expect(tourGallery).toMatch(/nextLabel/);
    expect(tourGallery).toMatch(/platformNames\[entry\.source\.platform\]/);
  });
});

describe('fully dynamic content — no placeholders (source guards)', () => {
  it('drives the homepage photo row only from the admin database', () => {
    const homepage = read('components/homepage.tsx');
    // No hardcoded photo array anywhere in the storefront component.
    expect(homepage).not.toMatch(/const galItems=\[/);
    expect(homepage).not.toMatch(/galItems\.filter/);
    expect(homepage).toMatch(/row\(dbPhotos,false\)/);
    expect(homepage).toMatch(/useHomepageGallery/);
  });

  it('renders the tour section only for real videos — no mock reels', () => {
    const tourGallery = read('components/tour-video-gallery.tsx');
    expect(tourGallery).not.toMatch(/previewPosters/);
    expect(tourGallery).not.toMatch(/tour-video-dashboard-note/);
    expect(tourGallery).not.toMatch(/tour-video-preview/);
    expect(tourGallery).not.toMatch(/if \(!items\.length\) return null/);
  });

  it('keeps the tour section visible with an honest empty message (no internal jargon)', () => {
    const tourGallery = read('components/tour-video-gallery.tsx');
    expect(tourGallery).toMatch(/tour-video-empty/);
    expect(tourGallery).toMatch(/No journey videos available right now/);
    expect(tourGallery).toMatch(/لا توجد فيديوهات حالياً/);
    expect(tourGallery).not.toMatch(/from the dashboard/);
    // Visitor-facing copy never uses em/en dashes.
    expect(tourGallery).not.toMatch(/—/);
    expect(tourGallery).not.toMatch(/–/);
  });

  it('ships an additive, non-destructive migration (applied once, with authorization)', () => {
    const sql = read('prisma/migrations/20261013000000_journey_gallery/migration.sql');
    expect(sql).toMatch(/CREATE TABLE `journey_gallery_items`/);
    expect(sql).toMatch(/CREATE TABLE `journey_gallery_tours`/);
    expect(sql).toMatch(/UNIQUE INDEX `journey_gallery_tours_itemId_tourSlug_key`/);
    expect(sql).not.toMatch(/DROP TABLE/);
    expect(sql).not.toMatch(/DELETE FROM `(tours|media_assets|users)`/);
    expect(sql).not.toMatch(/ALTER TABLE `(tours|media_assets)`/);
    const schema = read('prisma/schema.prisma');
    expect(schema).toMatch(/model JourneyGalleryItem/);
    expect(schema).toMatch(/model JourneyGalleryTour/);
  });

  it('keeps platform labels for every supported surface', () => {
    for (const platform of ['youtube', 'instagram', 'tiktok', 'facebook', 'vimeo', 'direct', 'external'] as const) {
      expect(galleryPlatformLabel(platform).length).toBeGreaterThan(0);
    }
  });
});

describe('admin API and permission conventions (source guards)', () => {
  const route = read('app/api/journey-gallery/route.ts');
  const byId = read('app/api/journey-gallery/[id]/route.ts');
  const reorder = read('app/api/journey-gallery/reorder/route.ts');
  const admin = read('app/admin/gallery/page.tsx');
  const form = read('components/admin/gallery-form.tsx');
  const newPage = read('app/admin/gallery/new/page.tsx');

  it('enforces gallery RBAC server-side with same-origin protection', () => {
    expect(route).toMatch(/hasPermission\(user, 'gallery\.create'\)/);
    expect(byId).toMatch(/hasPermission\(user, 'gallery\.edit'\)/);
    expect(byId).toMatch(/hasPermission\(user, 'gallery\.delete'\)/);
    expect(byId).toMatch(/hasPermission\(user, 'gallery\.view'\)/);
    expect(reorder).toMatch(/hasPermission\(user, 'gallery\.edit'\)/);
    for (const source of [route, byId, reorder]) {
      expect(source).toMatch(/isSameOriginRequest/);
      expect(source).toMatch(/Unauthorized/);
      expect(source).toMatch(/Forbidden/);
    }
  });

  it('serves published-only public feeds and never leaks drafts', () => {
    expect(route).toMatch(/listPublishedGallery/);
    expect(route).toMatch(/listTourGalleryItems/);
    expect(route).toMatch(/gallery\.view/);
  });

  it('serves uploaded videos with traversal-proof keys, sniffing protection, and ranges', () => {
    const serve = read('app/gallery-videos/[...path]/route.ts');
    expect(serve).toMatch(/getVideoAsset/);
    expect(serve).toMatch(/X-Content-Type-Options/);
    expect(serve).toMatch(/nosniff/);
    expect(serve).toMatch(/206/);
    expect(serve).toMatch(/Accept-Ranges/);
  });

  it('manages items from a dedicated create/edit page like the other catalogue modules', () => {
    expect(admin).toMatch(/href="\/admin\/gallery\/new"/);
    expect(admin).toMatch(/\/admin\/gallery\/new\?id=/);
    expect(newPage).toMatch(/useSearchParams/);
    expect(newPage).toMatch(/params\.get\('id'\)/);
    expect(newPage).toMatch(/<Suspense>/);
    expect(newPage).toMatch(/backHref="\/admin\/gallery"/);
    expect(newPage).toMatch(/GalleryForm/);
  });

  it('gives admins placement, scope, and multi-tour assignment controls with safe deletion', () => {
    expect(form).toMatch(/showOnHomepage/);
    expect(form).toMatch(/showOnTours/);
    expect(form).toMatch(/ALL_TOURS/);
    expect(form).toMatch(/SELECTED_TOURS/);
    expect(admin).toMatch(/AdminConfirmDialog/);
    expect(admin).toMatch(/setPublished|isPublished/);
    expect(admin).toMatch(/\/api\/journey-gallery\/reorder/);
    expect(form).toMatch(/role="alert"/);
  });

  it('edits through a real form with keyboard submit and searchable tour assignment', () => {
    expect(form).toMatch(/<form/);
    expect(form).toMatch(/onSubmit/);
    expect(form).toMatch(/type="submit"/);
    expect(form).toMatch(/Select shown/);
    expect(form).toMatch(/tourQuery/);
  });

  it('preserves entered data when switching type or video source', () => {
    expect(form).toMatch(/isCompatibleMediaUrl/);
    expect(form).toMatch(/switchMediaType/);
    // Video source switches keep the current URL; validation (not a wipe) guides corrections.
    expect(form).not.toMatch(/videoMode: next as .* mediaUrl: ''/);
  });

  it('reorders only on the unfiltered default ordering with boundary guards', () => {
    expect(admin).toMatch(/reorderReady/);
    expect(admin).toMatch(/canMoveUp/);
    expect(admin).toMatch(/canMoveDown/);
    expect(admin).toMatch(/Clear search, filters, and custom sorting to reorder/);
  });

  it('labels filters distinctly and keeps title rows compact', () => {
    expect(admin).toMatch(/All types/);
    expect(admin).toMatch(/All placements/);
    expect(admin).toMatch(/itemSubtitle/);
  });
});
