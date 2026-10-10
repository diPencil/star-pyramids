// Authoritative server-side media storage (P0 Fix 03 — real media files).
//
// Every image upload in the product (avatars, Trip Builder galleries,
// tours, offers, destinations, blogs, vehicles, events, brand logo and
// favicon) is persisted here instead of as a Base64 data URL inside a
// database column. Nothing in this module trusts the browser: the format
// is decided from magic bytes, the filename is generated server-side, and
// the public URL is always a same-origin absolute path.
//
// Storage layout (disk-backed, zero new dependencies — this project already
// runs on the Node.js server runtime with Prisma/MySQL):
//
//   <MEDIA_STORAGE_DIR>/<yyyy>/<mm>/<32 hex>.<ext>   → the stored file
//   MediaAsset.storageKey                            → the key above
//   MediaAsset.url                                   → `/media/<key>`
//
// `MEDIA_STORAGE_DIR` must point at a persistent, writable directory that
// survives restarts and deploys. See BACKEND_SETUP.md for hosting notes.
import 'server-only';

import { randomBytes } from 'node:crypto';
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { db } from './db';
import {
  MEDIA_URL_PREFIX,
  SUPPORTED_IMAGE_FORMATS,
  detectImageFormat,
  extensionOf,
  extensionToFormat,
  formatToExtension,
  formatToMime,
  isMediaStorageKey,
  mediaUrlFor,
  mimeToFormat,
  type SupportedImageFormat,
} from '../core/media-signature';

/**
 * Where uploads are classified. Only affects the stored audit label and the
 * permission gate applied by the route — the storage mechanics are shared.
 */
export type MediaScope = 'avatar' | 'brand' | 'catalogue';

export const MEDIA_SCOPES: readonly MediaScope[] = ['avatar', 'brand', 'catalogue'];

/** Server-side ceiling per file. Independent of any client-side limit. */
export const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Uploads allowed per uploader per hour. Staff galleries upload in bursts. */
export const UPLOADS_PER_HOUR = 120;

const UPLOAD_WINDOW_MS = 60 * 60 * 1000;

export type StoredMedia = {
  id: string;
  publicId: string;
  url: string;
  mimeType: string;
  extension: string;
  byteSize: number;
};

/** Rejects an unsupported upload with a message that is safe to return. */
export class MediaUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaUploadError';
  }
}

/** Absolute storage root. Resolved per call so tests can override it. */
export function mediaRootDir(): string {
  const configured = process.env.MEDIA_STORAGE_DIR?.trim();
  if (configured) return path.resolve(configured);
  return path.join(process.cwd(), 'storage', 'media');
}

export function maxUploadBytes(): number {
  const raw = Number(process.env.MEDIA_MAX_UPLOAD_BYTES);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MAX_UPLOAD_BYTES;
}

function formatList(): string {
  return SUPPORTED_IMAGE_FORMATS.map((format) => format.toUpperCase()).join(', ');
}

/**
 * Map a public `/media/...` URL back to its storage key. Returns null for
 * anything that is not an exact, well-formed media URL, so callers can
 * treat external links and legacy data URLs as non-managed media.
 */
export function storageKeyFromUrl(url: string): string | null {
  const value = url.trim();
  if (!value.startsWith(MEDIA_URL_PREFIX)) return null;
  const key = value.slice(MEDIA_URL_PREFIX.length);
  return isMediaStorageKey(key) ? key : null;
}

/**
 * Absolute on-disk path for a storage key. The key pattern is anchored and
 * slash-free per segment, and the resolved path is re-checked against the
 * root, so traversal (`..`, absolute paths, encoded separators) is
 * structurally impossible rather than merely filtered.
 */
export function resolveMediaPath(storageKey: string): string | null {
  if (!isMediaStorageKey(storageKey)) return null;
  const root = mediaRootDir();
  const resolved = path.resolve(root, storageKey);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

/**
 * Validate an operator-supplied filename against the detected format.
 * A missing or non-image extension is tolerated (operators often upload
 * `photo` with no extension); a real image extension that contradicts the
 * real bytes is a hard rejection.
 */
function assertExtensionMatches(
  filename: string,
  detected: SupportedImageFormat,
): void {
  const extension = extensionOf(filename);
  if (!extension) return;
  const declared = extensionToFormat(extension);
  if (declared && declared !== detected) {
    throw new MediaUploadError(
      `That file is a ${detected.toUpperCase()} image but is named ".${extension}".`,
    );
  }
}

/** Same cross-check for the browser-declared MIME type. */
function assertDeclaredTypeMatches(
  declaredType: string,
  detected: SupportedImageFormat,
): void {
  const declared = declaredType.trim().toLowerCase();
  if (!declared) return;
  const declaredFormat = mimeToFormat(declared);
  if (declaredFormat && declaredFormat !== detected) {
    throw new MediaUploadError(
      `That file is a ${detected.toUpperCase()} image, not ${declaredFormat.toUpperCase()}.`,
    );
  }
}

function buildStorageKey(extension: string): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  // 128 bits of CSPRNG output: unguessable, collision-free in practice,
  // and carries no user-supplied characters into the path.
  const name = randomBytes(16).toString('hex');
  return `${year}/${month}/${name}.${extension}`;
}

/**
 * Validate, persist and register one uploaded image.
 *
 * Order matters: content is validated in full before a single byte is
 * written, the file is written atomically (temp file + rename) so a
 * crashed request never leaves a truncated image readable, and the
 * database row is written last — if it fails, the orphaned file is
 * removed so the store never accumulates unreferenced media.
 */
export async function storeUploadedImage(input: {
  file: File;
  scope: MediaScope;
  uploaderId?: string | null;
}): Promise<StoredMedia> {
  const { file } = input;
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new MediaUploadError('Choose an image file to upload.');
  }

  const limit = maxUploadBytes();
  // `size` is advisory (client-controlled); the decoded buffer is the
  // authority. Reject before allocating anything unreasonably large.
  if (typeof file.size === 'number' && file.size > limit) {
    throw new MediaUploadError(`Images must be smaller than ${formatLimit(limit)}.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new MediaUploadError('That file is empty.');
  }
  if (buffer.byteLength > limit) {
    throw new MediaUploadError(`Images must be smaller than ${formatLimit(limit)}.`);
  }

  const detected = detectImageFormat(buffer);
  if (!detected) {
    throw new MediaUploadError(`Upload a ${formatList()} image.`);
  }
  assertDeclaredTypeMatches(file.type ?? '', detected);
  assertExtensionMatches(file.name ?? '', detected);

  const extension = formatToExtension(detected);
  const storageKey = buildStorageKey(extension);
  const destination = resolveMediaPath(storageKey);
  if (!destination) {
    throw new MediaUploadError('Could not prepare a storage location for that image.');
  }

  const directory = path.dirname(destination);
  // turbopackIgnore: the storage root is a runtime directory (configured by
  // MEDIA_STORAGE_DIR), not a build input. Without the hint the bundler
  // traces the entire project into the server output on every build.
  await mkdir(/* turbopackIgnore: true */ directory, { recursive: true });

  // Write to a private temp name first, then rename into place: readers
  // only ever observe a complete file.
  const temporary = path.join(directory, `.incoming-${path.basename(storageKey)}`);
  try {
    await writeFile(/* turbopackIgnore: true */ temporary, buffer, { flag: 'wx', mode: 0o644 });
    await rename(/* turbopackIgnore: true */ temporary, destination);
  } catch (error) {
    await unlink(/* turbopackIgnore: true */ temporary).catch(() => undefined);
    throw error;
  }

  try {
    const row = await db.mediaAsset.create({
      data: {
        storageKey,
        url: mediaUrlFor(storageKey),
        mimeType: formatToMime(detected),
        extension,
        byteSize: buffer.byteLength,
        scope: input.scope,
        uploaderId: input.uploaderId ?? null,
      },
      select: { id: true, publicId: true, url: true, mimeType: true, extension: true, byteSize: true },
    });
    return row;
  } catch (error) {
    // The row is what makes the file addressable; without it the file is
    // unreachable, so remove it rather than leaking disk space.
    await unlink(/* turbopackIgnore: true */ destination).catch(() => undefined);
    throw error;
  }
}

/** Metadata for one stored file, or null when the key is unknown. */
export async function getMediaAsset(storageKey: string) {
  if (!isMediaStorageKey(storageKey)) return null;
  return db.mediaAsset.findUnique({ where: { storageKey } });
}

/**
 * Authenticated per-uploader upload budget. Uses the media table itself
 * rather than a new attempt table: the counter must never accept a write
 * that did not store a file.
 */
export async function checkMediaUploadRateLimit(
  uploaderId: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const windowStart = new Date(Date.now() - UPLOAD_WINDOW_MS);
  const recent = await db.mediaAsset.count({
    where: { uploaderId, createdAt: { gte: windowStart } },
  });
  if (recent < UPLOADS_PER_HOUR) return { allowed: true, retryAfterSeconds: 0 };
  const oldest = await db.mediaAsset.findFirst({
    where: { uploaderId, createdAt: { gte: windowStart } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  return {
    allowed: false,
    retryAfterSeconds: oldest
      ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + UPLOAD_WINDOW_MS - Date.now()) / 1000))
      : Math.floor(UPLOAD_WINDOW_MS / 1000),
  };
}

/** Size + mtime for conditional-request handling on the media route. */
export async function statMediaFile(
  storageKey: string,
): Promise<{ size: number; mtimeMs: number } | null> {
  const resolved = resolveMediaPath(storageKey);
  if (!resolved) return null;
  try {
    const info = await stat(/* turbopackIgnore: true */ resolved);
    if (!info.isFile()) return null;
    return { size: info.size, mtimeMs: info.mtimeMs };
  } catch {
    return null;
  }
}

function formatLimit(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}