// P0 Fix 03 — server-side media storage service.
//
// Exercises the real filesystem (a temp storage root) and the real
// validation pipeline: magic-byte format detection, size limits,
// MIME/extension cross-checks, safe path resolution, and the guarantee
// that a failed database write never leaves an orphaned file behind.
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const PNG_1PX_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/5+hHgAAXolJLoIAAAAASUVORK5CYII=';

const pngBytes = () => new Uint8Array(fromBase64(PNG_1PX_BASE64));

function fromBase64(value: string): number[] {
  const binary = atob(value);
  return Array.from(binary, (char) => char.charCodeAt(0));
}

function imageFile(
  bytes: Uint8Array,
  name = 'holiday.png',
  type = 'image/png',
): File {
  return new File([bytes as unknown as BlobPart], name, { type });
}

let root: string;

async function loadMedia() {
  vi.resetModules();
  return import('@/lib/server/media');
}

async function loadDb() {
  return import('@/lib/server/db');
}

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'sp-media-'));
  process.env.MEDIA_STORAGE_DIR = root;
});

afterAll(async () => {
  delete process.env.MEDIA_STORAGE_DIR;
  await rm(root, { recursive: true, force: true });
});

beforeEach(async () => {
  delete process.env.MEDIA_MAX_UPLOAD_BYTES;
  // Each test asserts on the exact set of files on disk, so the storage
  // root must start empty.
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Collect every file written under the storage root, temp files included. */
async function storedFiles(): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string) => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else out.push(path.relative(root, full).split(path.sep).join('/'));
    }
  };
  await walk(root);
  return out.sort();
}

/**
 * Replace db.mediaAsset.create with a stub that echoes the row the service
 * asked for, so assertions can read the real storage key and URL.
 */
async function stubMediaAssetCreate() {
  const { db } = await loadDb();
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'asset-1',
    publicId: 'pub-1',
    url: data.url,
    mimeType: data.mimeType,
    extension: data.extension,
    byteSize: data.byteSize,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).mediaAsset = { create };
  return create;
}

describe('storeUploadedImage — accepted uploads', () => {
  it('stores a real PNG and returns a public /media URL', async () => {
    const { storeUploadedImage } = await loadMedia();
    const create = await stubMediaAssetCreate();

    const media = await storeUploadedImage({
      file: imageFile(pngBytes()),
      scope: 'catalogue',
      uploaderId: 'user-1',
    });

    expect(media.url).toMatch(/^\/media\/\d{4}\/\d{2}\/[0-9a-f]{32}\.png$/);
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.mimeType).toBe('image/png');
    expect(data.extension).toBe('png');
    expect(data.scope).toBe('catalogue');
    expect(data.uploaderId).toBe('user-1');
    expect(data.url).toBe(`/media/${data.storageKey}`);
    expect(await storedFiles()).toEqual([data.storageKey]);
  });

  it('names files from server randomness, never from the upload name', async () => {
    const { storeUploadedImage } = await loadMedia();
    await stubMediaAssetCreate();

    const media = await storeUploadedImage({
      // A hostile filename must not influence the stored path.
      file: imageFile(pngBytes(), '../../../etc/passwd.png'),
      scope: 'catalogue',
    });

    expect(media.url).not.toContain('passwd');
    expect(media.url).toMatch(/^\/media\/\d{4}\/\d{2}\/[0-9a-f]{32}\.png$/);
  });

  it('generates a distinct key for every upload of the same file', async () => {
    const { storeUploadedImage } = await loadMedia();
    await stubMediaAssetCreate();

    const first = await storeUploadedImage({ file: imageFile(pngBytes()), scope: 'catalogue' });
    const second = await storeUploadedImage({ file: imageFile(pngBytes()), scope: 'catalogue' });

    expect(first.url).not.toBe(second.url);
  });

  it('derives the stored extension from the real content, not the name', async () => {
    const { storeUploadedImage } = await loadMedia();
    const create = await stubMediaAssetCreate();

    // A name that carries no image extension must not change the format.
    await storeUploadedImage({
      file: imageFile(pngBytes(), 'mislabelled-file'),
      scope: 'catalogue',
    });

    expect(create.mock.calls[0][0].data.extension).toBe('png');
  });
});

describe('storeUploadedImage — rejected uploads', () => {
  it('rejects a non-image payload regardless of its declared type', async () => {
    const { MediaUploadError, storeUploadedImage } = await loadMedia();
    const create = await stubMediaAssetCreate();

    await expect(
      storeUploadedImage({
        file: imageFile(new TextEncoder().encode('#!/bin/sh\nrm -rf /'), 'shell.png', 'image/png'),
        scope: 'catalogue',
      }),
    ).rejects.toBeInstanceOf(MediaUploadError);

    expect(create).not.toHaveBeenCalled();
    expect(await storedFiles()).toEqual([]);
  });

  it('rejects SVG uploads even when declared as an image', async () => {
    const { MediaUploadError, storeUploadedImage } = await loadMedia();
    await stubMediaAssetCreate();
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');

    await expect(
      storeUploadedImage({ file: imageFile(svg, 'logo.svg', 'image/svg+xml'), scope: 'brand' }),
    ).rejects.toBeInstanceOf(MediaUploadError);
    expect(await storedFiles()).toEqual([]);
  });

  it('rejects an empty file', async () => {
    const { MediaUploadError, storeUploadedImage } = await loadMedia();
    await stubMediaAssetCreate();

    await expect(
      storeUploadedImage({ file: imageFile(new Uint8Array(0)), scope: 'catalogue' }),
    ).rejects.toBeInstanceOf(MediaUploadError);
    expect(await storedFiles()).toEqual([]);
  });

  it('rejects a file above the configured size limit', async () => {
    process.env.MEDIA_MAX_UPLOAD_BYTES = '32';
    const { MediaUploadError, storeUploadedImage } = await loadMedia();
    await stubMediaAssetCreate();

    await expect(
      storeUploadedImage({ file: imageFile(pngBytes()), scope: 'catalogue' }),
    ).rejects.toBeInstanceOf(MediaUploadError);
    expect(await storedFiles()).toEqual([]);
  });

  it('rejects a declared type that contradicts the real bytes', async () => {
    const { MediaUploadError, storeUploadedImage } = await loadMedia();
    await stubMediaAssetCreate();

    await expect(
      storeUploadedImage({
        file: imageFile(pngBytes(), 'photo.png', 'image/gif'),
        scope: 'catalogue',
      }),
    ).rejects.toBeInstanceOf(MediaUploadError);
    expect(await storedFiles()).toEqual([]);
  });

  it('rejects an image extension that contradicts the real bytes', async () => {
    const { MediaUploadError, storeUploadedImage } = await loadMedia();
    await stubMediaAssetCreate();

    await expect(
      storeUploadedImage({
        file: imageFile(pngBytes(), 'photo.webp'),
        scope: 'catalogue',
      }),
    ).rejects.toBeInstanceOf(MediaUploadError);
    expect(await storedFiles()).toEqual([]);
  });

  it('tolerates a missing or non-image extension on a genuine image', async () => {
    const { storeUploadedImage } = await loadMedia();
    await stubMediaAssetCreate();

    await expect(
      storeUploadedImage({ file: imageFile(pngBytes(), 'holiday-photo'), scope: 'catalogue' }),
    ).resolves.toMatchObject({ extension: 'png' });
  });
});

describe('storeUploadedImage — storage integrity', () => {
  it('removes the file when the database write fails', async () => {
    const { storeUploadedImage } = await loadMedia();
    await stubMediaAssetCreate();
    const { db } = await loadDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).mediaAsset = { create: vi.fn().mockRejectedValue(new Error('db down')) };

    await expect(
      storeUploadedImage({ file: imageFile(pngBytes()), scope: 'catalogue' }),
    ).rejects.toThrow('db down');

    // No file (and no leftover .incoming-* temp file) may survive.
    expect(await storedFiles()).toEqual([]);
  });

  it('never leaves an .incoming- temp file behind on success', async () => {
    const { storeUploadedImage } = await loadMedia();
    await stubMediaAssetCreate();

    await storeUploadedImage({ file: imageFile(pngBytes()), scope: 'catalogue' });

    expect((await storedFiles()).some((name) => name.includes('.incoming-'))).toBe(false);
  });
});

describe('resolveMediaPath', () => {
  it('resolves a valid key inside the storage root', async () => {
    const { mediaRootDir, resolveMediaPath } = await loadMedia();
    const key = `2026/10/${'b'.repeat(32)}.webp`;
    expect(resolveMediaPath(key)).toBe(path.join(mediaRootDir(), '2026', '10', `${'b'.repeat(32)}.webp`));
  });

  it('refuses anything that is not a well-formed key', async () => {
    const { resolveMediaPath } = await loadMedia();
    expect(resolveMediaPath('../../../etc/passwd')).toBeNull();
    expect(resolveMediaPath('/etc/passwd')).toBeNull();
    expect(resolveMediaPath('')).toBeNull();
    expect(resolveMediaPath('2026/10/nope.png')).toBeNull();
  });

  it('honours MEDIA_STORAGE_DIR instead of the bundled public folder', async () => {
    const { mediaRootDir } = await loadMedia();
    expect(mediaRootDir()).toBe(root);
  });
});

describe('storageKeyFromUrl', () => {
  it('round-trips a stored URL and ignores foreign references', async () => {
    const { storageKeyFromUrl } = await loadMedia();
    const key = `2026/10/${'c'.repeat(32)}.jpg`;

    expect(storageKeyFromUrl(`/media/${key}`)).toBe(key);
    // External links and legacy data URLs are not managed media.
    expect(storageKeyFromUrl('https://cdn.example.com/a.jpg')).toBeNull();
    expect(storageKeyFromUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(storageKeyFromUrl('/logo.png')).toBeNull();
    expect(storageKeyFromUrl('/media/../secret')).toBeNull();
  });
});