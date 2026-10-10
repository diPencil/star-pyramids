// P0 Fix 03 — media signature validation.
//
// These tests pin the security contract of server-side media storage: the
// format is decided from magic bytes, and unsupported or spoofed payloads
// never reach the disk.
import { describe, expect, it } from 'vitest';

import {
  IMAGE_FORMAT_EXTENSIONS,
  MEDIA_URL_PREFIX,
  SUPPORTED_IMAGE_FORMATS,
  detectImageFormat,
  extensionOf,
  extensionToFormat,
  formatToMime,
  isMediaStorageKey,
  isSupportedImageMime,
  mediaUrlFor,
  mimeToFormat,
} from '@/lib/core/media-signature';

const bytes = (...values: number[]) => new Uint8Array(values);

const ascii = (text: string) => new TextEncoder().encode(text);

/** Real 1x1 PNG, used so the fixture is genuine rather than hand-built. */
const PNG_1PX = new Uint8Array(
  Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/5+hHgAAXolJLoIAAAAASUVORK5CYII='),
    (char) => char.charCodeAt(0),
  ),
);

const JPEG_SOI = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10);
const RIFF = 'RIFF';

const WEBP = new Uint8Array([
  ...ascii(RIFF),
  0x1a,
  0x00,
  0x00,
  0x00,
  ...ascii('WEBP'),
  0x56,
  0x50,
  0x38,
  0x20,
]);

const GIF87A = ascii('GIF87a');
const GIF89A = ascii('GIF89a');

describe('detectImageFormat', () => {
  it('identifies each supported format from its magic bytes', () => {
    expect(detectImageFormat(PNG_1PX)).toBe('png');
    expect(detectImageFormat(JPEG_SOI)).toBe('jpeg');
    expect(detectImageFormat(WEBP)).toBe('webp');
    expect(detectImageFormat(GIF87A)).toBe('gif');
    expect(detectImageFormat(GIF89A)).toBe('gif');
  });

  it('rejects payloads that are not supported images', () => {
    expect(detectImageFormat(new Uint8Array(0))).toBeNull();
    expect(detectImageFormat(ascii('hello world'))).toBeNull();
    expect(detectImageFormat(ascii('%PDF-1.7\n'))).toBeNull();
    expect(detectImageFormat(bytes(0x00, 0x00, 0x00, 0x00))).toBeNull();
  });

  it('rejects SVG and other XML/HTML payloads that can carry script', () => {
    expect(detectImageFormat(ascii('<?xml version="1.0"?><svg onload="x()"/>'))).toBeNull();
    expect(detectImageFormat(ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageFormat(ascii('<script>alert(1)</script>'))).toBeNull();
  });

  it('rejects ELF and ZIP binaries regardless of the declared name', () => {
    expect(detectImageFormat(bytes(0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01))).toBeNull();
    expect(detectImageFormat(bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00))).toBeNull();
  });

  it('rejects headers truncated below the signature length', () => {
    expect(detectImageFormat(bytes(0xff, 0xd8))).toBeNull();
    expect(detectImageFormat(bytes(0x89, 0x50, 0x4e))).toBeNull();
    expect(detectImageFormat(ascii('RIFF'))).toBeNull();
    // RIFF container that is not WEBP must not be accepted.
    expect(detectImageFormat(ascii(`${RIFF}\x00\x00\x00\x00WAVE`))).toBeNull();
  });

  it('covers every advertised format', () => {
    for (const format of SUPPORTED_IMAGE_FORMATS) {
      expect(formatToMime(format)).toMatch(/^image\//);
      expect(IMAGE_FORMAT_EXTENSIONS[format]).toMatch(/^[a-z]+$/);
    }
  });
});

describe('declared type and extension cross-checks', () => {
  it('maps the MIME aliases browsers still emit', () => {
    expect(mimeToFormat('image/jpeg')).toBe('jpeg');
    expect(mimeToFormat('IMAGE/JPG')).toBe('jpeg');
    expect(mimeToFormat('image/pjpeg')).toBe('jpeg');
    expect(mimeToFormat('image/png')).toBe('png');
    expect(mimeToFormat(' image/webp ')).toBe('webp');
    expect(mimeToFormat('image/gif')).toBe('gif');
  });

  it('does not treat non-image or unknown types as images', () => {
    expect(mimeToFormat('image/svg+xml')).toBeNull();
    expect(mimeToFormat('application/pdf')).toBeNull();
    expect(mimeToFormat('text/html')).toBeNull();
    expect(mimeToFormat('')).toBeNull();
    expect(isSupportedImageMime('image/jpg')).toBe(false);
    expect(isSupportedImageMime('image/png')).toBe(true);
  });

  it('reads extensions from operator filenames', () => {
    expect(extensionOf('photo.JPG')).toBe('jpg');
    expect(extensionOf('holiday.photo.webp')).toBe('webp');
    expect(extensionOf('C:\\images\\a.png')).toBe('png');
    expect(extensionOf('no-extension')).toBe('');
    expect(extensionOf('trailing.')).toBe('');
    expect(extensionOf('.hidden')).toBe('');
  });

  it('resolves only real image extensions', () => {
    expect(extensionToFormat('jpg')).toBe('jpeg');
    expect(extensionToFormat('.JPEG')).toBe('jpeg');
    expect(extensionToFormat('png')).toBe('png');
    expect(extensionToFormat('svg')).toBeNull();
    expect(extensionToFormat('php')).toBeNull();
    expect(extensionToFormat('exe')).toBeNull();
  });
});

describe('storage key validation', () => {
  const key = `2026/10/${'a'.repeat(32)}.png`;

  it('accepts a well-formed key', () => {
    expect(isMediaStorageKey(key)).toBe(true);
    expect(mediaUrlFor(key)).toBe(`${MEDIA_URL_PREFIX}${key}`);
  });

  it('rejects traversal, absolute paths and separators', () => {
    expect(isMediaStorageKey('../../../etc/passwd')).toBe(false);
    expect(isMediaStorageKey('2026/10/../../secret.png')).toBe(false);
    expect(isMediaStorageKey('/etc/passwd')).toBe(false);
    expect(isMediaStorageKey('C:\\Windows\\win.ini')).toBe(false);
    expect(isMediaStorageKey('..\\..\\file.png')).toBe(false);
    expect(isMediaStorageKey(`2026/10/${'a'.repeat(31)}/../x.png`)).toBe(false);
  });

  it('rejects keys with unexpected names or extensions', () => {
    expect(isMediaStorageKey('')).toBe(false);
    expect(isMediaStorageKey('2026/10/short.png')).toBe(false);
    expect(isMediaStorageKey(`2026/10/${'A'.repeat(32)}.png`)).toBe(false);
    expect(isMediaStorageKey(`2026/10/${'a'.repeat(32)}.svg`)).toBe(false);
    expect(isMediaStorageKey(`2026/10/${'a'.repeat(32)}.png.txt`)).toBe(false);
    expect(isMediaStorageKey(`${'a'.repeat(32)}.png`)).toBe(false);
  });
});