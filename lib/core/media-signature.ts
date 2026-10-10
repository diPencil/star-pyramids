// Backend core — environment-neutral (Next.js server runtime AND trusted
// Node CLI scripts). Pure functions only: no Node.js APIs, no Next.js
// imports, no Prisma. Same boundary rules as lib/core/validation.ts —
// server/CLI only, never client components.
//
// The browser-reported `File.type` is attacker-controlled: any extension
// can be renamed to `.png` and any MIME string can be forged. Real media
// validation therefore reads the file's magic bytes and decides the
// format from content alone; the declared type/extension are only used as
// a cross-check that the operator uploaded what they thought they did.

export type SupportedImageFormat = 'jpeg' | 'png' | 'webp' | 'gif';

export type SupportedImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

/** Formats the media store accepts. Order drives user-facing messages. */
export const SUPPORTED_IMAGE_FORMATS: readonly SupportedImageFormat[] = [
  'jpeg',
  'png',
  'webp',
  'gif',
];

export const SUPPORTED_IMAGE_MIMES: readonly SupportedImageMime[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

/** Canonical stored extension per format. Never derived from user input. */
export const IMAGE_FORMAT_EXTENSIONS: Readonly<Record<SupportedImageFormat, string>> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
};

const FORMAT_MIMES: Readonly<Record<SupportedImageFormat, SupportedImageMime>> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/**
 * Declared-type aliases browsers still emit. Anything absent from this map
 * is treated as "not an image type" and only ever rejected when it
 * contradicts a successfully detected format.
 */
const MIME_ALIASES: Readonly<Record<string, SupportedImageFormat>> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/pjpeg': 'jpeg',
  'image/png': 'png',
  'image/x-png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Extensions accepted in an operator-supplied filename, mapped to format. */
const EXTENSION_ALIASES: Readonly<Record<string, SupportedImageFormat>> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  jpe: 'jpeg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
};

/**
 * Storage keys are always `<yyyy>/<mm>/<32 hex>.<ext>`. The pattern is
 * anchored and slash-free at every level, so a key can never escape the
 * storage root or reach an unexpected directory.
 */
export const MEDIA_STORAGE_KEY_PATTERN =
  /^\d{4}\/\d{2}\/[0-9a-f]{32}\.(?:jpg|png|webp|gif)$/;

/** Public URL prefix served by the media route handler. */
export const MEDIA_URL_PREFIX = '/media/';

const ascii = (text: string): number[] => Array.from(text, (char) => char.charCodeAt(0));

const startsWith = (
  bytes: Uint8Array,
  signature: readonly number[],
  offset = 0,
): boolean => {
  if (bytes.length < offset + signature.length) return false;
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[offset + index] !== signature[index]) return false;
  }
  return true;
};

/**
 * Identify an image format from its leading bytes. Returns null for every
 * unsupported or malformed payload — callers must treat null as a hard
 * rejection and never fall back to the declared MIME type or extension.
 */
export function detectImageFormat(bytes: Uint8Array): SupportedImageFormat | null {
  // ISO-BMFF container carrying a WEBP payload: `RIFF????WEBP`.
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) {
    return 'webp';
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) {
    return 'gif';
  }
  return null;
}

/** True when the browser-declared type names a format this store accepts. */
export function isSupportedImageMime(value: string): value is SupportedImageMime {
  return (SUPPORTED_IMAGE_MIMES as readonly string[]).includes(value.trim().toLowerCase());
}

export function formatToMime(format: SupportedImageFormat): SupportedImageMime {
  return FORMAT_MIMES[format];
}

export function formatToExtension(format: SupportedImageFormat): string {
  return IMAGE_FORMAT_EXTENSIONS[format];
}

/**
 * Resolve a browser-declared MIME type to a format, or null when the type
 * is not an image type this store supports.
 */
export function mimeToFormat(value: string): SupportedImageFormat | null {
  return MIME_ALIASES[value.trim().toLowerCase()] ?? null;
}

/** Lower-cased extension of a filename, or '' when it has none. */
export function extensionOf(filename: string): string {
  const base = filename.trim().split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return '';
  return base.slice(dot + 1).toLowerCase();
}

/** Format implied by a filename extension, or null when it is not an image. */
export function extensionToFormat(extension: string): SupportedImageFormat | null {
  return EXTENSION_ALIASES[extension.trim().toLowerCase().replace(/^\./, '')] ?? null;
}

/** Public, stable check used by the media route before touching the disk. */
export function isMediaStorageKey(value: string): boolean {
  return MEDIA_STORAGE_KEY_PATTERN.test(value);
}

/** Public URL for a stored file. Always same-origin and absolute-path. */
export function mediaUrlFor(storageKey: string): string {
  return `${MEDIA_URL_PREFIX}${storageKey}`;
}