// Backend core — environment-neutral (Next.js server runtime AND trusted
// Node CLI scripts). Pure functions only: no Node.js APIs, no Next.js
// imports, no Prisma. Same boundary rules as lib/core/media-signature.ts —
// server/CLI only, never client components.
//
// Browser-reported `File.type` is attacker-controlled, so uploaded journey
// videos are identified from magic bytes alone. Only browser-playable
// MP4 (ISO-BMFF `ftyp`) and WebM (EBML header) containers are accepted.

export type SupportedVideoFormat = 'mp4' | 'webm';

export type SupportedVideoMime = 'video/mp4' | 'video/webm';

/** Formats the journey-gallery video store accepts. */
export const SUPPORTED_VIDEO_FORMATS: readonly SupportedVideoFormat[] = ['mp4', 'webm'];

export const SUPPORTED_VIDEO_MIMES: readonly SupportedVideoMime[] = ['video/mp4', 'video/webm'];

/** Canonical stored extension per format. Never derived from user input. */
export const VIDEO_FORMAT_EXTENSIONS: Readonly<Record<SupportedVideoFormat, string>> = {
  mp4: 'mp4',
  webm: 'webm',
};

const VIDEO_FORMAT_MIMES: Readonly<Record<SupportedVideoFormat, SupportedVideoMime>> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
};

const VIDEO_MIME_ALIASES: Readonly<Record<string, SupportedVideoFormat>> = {
  'video/mp4': 'mp4',
  'video/mpeg4': 'mp4',
  'video/webm': 'webm',
};

const VIDEO_EXTENSION_ALIASES: Readonly<Record<string, SupportedVideoFormat>> = {
  mp4: 'mp4',
  m4v: 'mp4',
  webm: 'webm',
};

/**
 * Storage keys are always `<yyyy>/<mm>/<32 hex>.<ext>`. Anchored and
 * slash-free at every level, so a key can never escape the storage root.
 * Deliberately disjoint from the image key pattern: image routes keep
 * accepting images only, video routes accept videos only.
 */
export const VIDEO_STORAGE_KEY_PATTERN = /^\d{4}\/\d{2}\/[0-9a-f]{32}\.(?:mp4|webm)$/;

/** Public URL prefix served by the journey-video route handler. */
export const VIDEO_URL_PREFIX = '/gallery-videos/';

const ascii = (text: string): number[] => Array.from(text, (char) => char.charCodeAt(0));

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean => {
  if (bytes.length < offset + signature.length) return false;
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[offset + index] !== signature[index]) return false;
  }
  return true;
};

/**
 * Identify an uploaded video format from its leading bytes. Returns null
 * for every unsupported or malformed payload — callers must treat null as
 * a hard rejection and never fall back to the declared MIME type.
 */
export function detectVideoFormat(bytes: Uint8Array): SupportedVideoFormat | null {
  // WebM/Matroska: EBML header `1A 45 DF A3`.
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return 'webm';
  // MP4/M4V: ISO-BMFF box with `ftyp` at offset 4.
  if (bytes.length >= 12 && startsWith(bytes, ascii('ftyp'), 4)) return 'mp4';
  return null;
}

export function formatToVideoMime(format: SupportedVideoFormat): SupportedVideoMime {
  return VIDEO_FORMAT_MIMES[format];
}

export function formatToVideoExtension(format: SupportedVideoFormat): string {
  return VIDEO_FORMAT_EXTENSIONS[format];
}

export function videoMimeToFormat(value: string): SupportedVideoFormat | null {
  return VIDEO_MIME_ALIASES[value.trim().toLowerCase()] ?? null;
}

export function videoExtensionToFormat(extension: string): SupportedVideoFormat | null {
  return VIDEO_EXTENSION_ALIASES[extension.trim().toLowerCase().replace(/^\./, '')] ?? null;
}

/** Public, stable check used before touching the disk. */
export function isVideoStorageKey(value: string): boolean {
  return VIDEO_STORAGE_KEY_PATTERN.test(value);
}

/** Public URL for a stored video. Always same-origin and absolute-path. */
export function videoUrlFor(storageKey: string): string {
  return `${VIDEO_URL_PREFIX}${storageKey}`;
}
