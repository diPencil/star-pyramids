// Authoritative server-side journey-video storage.
//
// Mirrors lib/server/media.ts (images) for uploaded MP4/WebM gallery
// videos: content is validated from magic bytes before a single byte is
// written, the filename is generated server-side, the file lands
// atomically (temp file + rename), and the MediaAsset row is written last
// (orphaned files are removed when the row write fails).
//
// Videos live under the SAME storage root but in a DISJOINT key namespace
// (`<yyyy>/<mm>/<32 hex>.mp4|.webm` served as `/gallery-videos/...`), so
// the image route keeps accepting images only and existing media behavior
// is untouched.
import 'server-only';

import { randomBytes } from 'node:crypto';
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { db } from './db';
import { checkMediaUploadRateLimit, mediaRootDir } from './media';
import {
  SUPPORTED_VIDEO_FORMATS,
  detectVideoFormat,
  formatToVideoExtension,
  formatToVideoMime,
  isVideoStorageKey,
  videoExtensionToFormat,
  videoMimeToFormat,
  videoUrlFor,
  type SupportedVideoFormat,
} from '../core/video-signature';
import { MAX_GALLERY_VIDEO_BYTES } from '../journey-gallery';

export { checkMediaUploadRateLimit };

/** Rejects an unsupported upload with a message that is safe to return. */
export class VideoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoUploadError';
  }
}

export type StoredVideo = {
  id: string;
  publicId: string;
  url: string;
  mimeType: string;
  extension: string;
  byteSize: number;
};

function formatList(): string {
  return SUPPORTED_VIDEO_FORMATS.map((format) => format.toUpperCase()).join(', ');
}

export function videoRootDir(): string {
  return mediaRootDir();
}

/**
 * Absolute on-disk path for a video storage key. Same traversal-proof
 * resolution as images: anchored pattern + re-check against the root.
 */
export function resolveVideoPath(storageKey: string): string | null {
  if (!isVideoStorageKey(storageKey)) return null;
  const root = videoRootDir();
  const resolved = path.resolve(root, storageKey);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

function assertExtensionMatches(filename: string, detected: SupportedVideoFormat): void {
  const base = filename.trim().split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  const extension = dot <= 0 || dot === base.length - 1 ? '' : base.slice(dot + 1).toLowerCase();
  if (!extension) return;
  const declared = videoExtensionToFormat(extension);
  if (declared && declared !== detected) {
    throw new VideoUploadError(
      `That file is a ${detected.toUpperCase()} video but is named ".${extension}".`,
    );
  }
}

function assertDeclaredTypeMatches(declaredType: string, detected: SupportedVideoFormat): void {
  const declared = declaredType.trim().toLowerCase();
  if (!declared) return;
  const declaredFormat = videoMimeToFormat(declared);
  if (declaredFormat && declaredFormat !== detected) {
    throw new VideoUploadError(
      `That file is a ${detected.toUpperCase()} video, not ${declaredFormat.toUpperCase()}.`,
    );
  }
}

function buildVideoStorageKey(extension: string): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const name = randomBytes(16).toString('hex');
  return `${year}/${month}/${name}.${extension}`;
}

/**
 * Validate, persist and register one uploaded journey video.
 *
 * Strict 5 MB ceiling enforced on the decoded buffer (the authority —
 * `File.size` is advisory). Only browser-playable MP4/WebM containers.
 */
export async function storeUploadedVideo(input: {
  file: File;
  uploaderId?: string | null;
}): Promise<StoredVideo> {
  const { file } = input;
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new VideoUploadError('Choose a video file to upload.');
  }

  const limit = MAX_GALLERY_VIDEO_BYTES;
  if (typeof file.size === 'number' && file.size > limit) {
    throw new VideoUploadError('Videos must be 5 MB or smaller.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new VideoUploadError('That file is empty.');
  }
  if (buffer.byteLength > limit) {
    throw new VideoUploadError('Videos must be 5 MB or smaller.');
  }

  const detected = detectVideoFormat(buffer);
  if (!detected) {
    throw new VideoUploadError(`Upload a ${formatList()} video.`);
  }
  assertDeclaredTypeMatches(file.type ?? '', detected);
  assertExtensionMatches(file.name ?? '', detected);

  const extension = formatToVideoExtension(detected);
  const storageKey = buildVideoStorageKey(extension);
  const destination = resolveVideoPath(storageKey);
  if (!destination) {
    throw new VideoUploadError('Could not prepare a storage location for that video.');
  }

  const directory = path.dirname(destination);
  // turbopackIgnore: the storage root is a runtime directory (configured by
  // MEDIA_STORAGE_DIR), not a build input.
  await mkdir(/* turbopackIgnore: true */ directory, { recursive: true });

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
        url: videoUrlFor(storageKey),
        mimeType: formatToVideoMime(detected),
        extension,
        byteSize: buffer.byteLength,
        scope: 'catalogue',
        uploaderId: input.uploaderId ?? null,
      },
      select: { id: true, publicId: true, url: true, mimeType: true, extension: true, byteSize: true },
    });
    return row;
  } catch (error) {
    await unlink(/* turbopackIgnore: true */ destination).catch(() => undefined);
    throw error;
  }
}

/** Metadata for one stored video, or null when the key is unknown. */
export async function getVideoAsset(storageKey: string) {
  if (!isVideoStorageKey(storageKey)) return null;
  return db.mediaAsset.findUnique({ where: { storageKey } });
}

/** Size + mtime for conditional-request and range handling. */
export async function statVideoFile(
  storageKey: string,
): Promise<{ size: number; mtimeMs: number } | null> {
  const resolved = resolveVideoPath(storageKey);
  if (!resolved) return null;
  try {
    const info = await stat(/* turbopackIgnore: true */ resolved);
    if (!info.isFile()) return null;
    return { size: info.size, mtimeMs: info.mtimeMs };
  } catch {
    return null;
  }
}
