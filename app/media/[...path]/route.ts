import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { getMediaAsset, resolveMediaPath, statMediaFile } from '@/lib/server/media';

// Stored images are served from the filesystem through this route, so the
// Node.js runtime is required (never the Edge runtime).
export const runtime = 'nodejs';
// Asset URLs are unique per upload, so nothing here may be prerendered or
// cached at the framework layer — the response is cached by the browser.
export const dynamic = 'force-dynamic';

function notFound(): Response {
  return new Response('Not found.', {
    status: 404,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/**
 * Public read endpoint for stored media.
 *
 * - The requested segments are joined back into a storage key and matched
 *   against an anchored pattern before any filesystem access, so traversal
 *   attempts never reach the disk.
 * - The MIME type comes from the MediaAsset row (recorded from magic bytes
 *   at upload time), never from the request or the file extension, and
 *   `X-Content-Type-Options: nosniff` prevents content sniffing.
 * - Keys are content-unique and never reused, which is what makes the
 *   immutable cache header safe: replacing an image stores a new file.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  const { path: segments } = await params;
  if (!Array.isArray(segments) || segments.length === 0) return notFound();

  const storageKey = segments.join('/');
  const asset = await getMediaAsset(storageKey).catch(() => null);
  if (!asset) return notFound();

  const filePath = resolveMediaPath(asset.storageKey);
  if (!filePath) return notFound();

  const info = await statMediaFile(asset.storageKey);
  if (!info) return notFound();

  // Conditional request: ETag stays stable for the life of the asset.
  const etag = `"${asset.id}-${info.size.toString(16)}"`;
  const headers = new Headers({
    'Content-Type': asset.mimeType,
    'Content-Length': String(info.size),
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    ETag: etag,
    'Last-Modified': new Date(info.mtimeMs).toUTCString(),
  });

  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch && ifNoneMatch.split(',').some((tag) => tag.trim() === etag)) {
    return new Response(null, { status: 304, headers });
  }

  const stream = Readable.toWeb(
    // turbopackIgnore: reads happen at request time from MEDIA_STORAGE_DIR,
    // a runtime directory that must never be traced into the build output.
    createReadStream(/* turbopackIgnore: true */ filePath),
  ) as unknown as ReadableStream<Uint8Array>;

  return new Response(stream, { status: 200, headers });
}