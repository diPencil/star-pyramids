import { createReadStream } from 'node:fs';

import { Readable } from 'node:stream';

import { getVideoAsset, resolveVideoPath, statVideoFile } from '@/lib/server/journey-video-storage';

// Stored journey videos are served from the filesystem through this route,
// so the Node.js runtime is required (never the Edge runtime).
export const runtime = 'nodejs';
// Asset URLs are unique per upload, so nothing here may be prerendered or
// cached at the framework layer — the response is cached by the browser.
export const dynamic = 'force-dynamic';

const CHUNK_SIZE = 2 * 1024 * 1024;

function notFound(): Response {
  return new Response('Not found.', {
    status: 404,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, startRaw, endRaw] = match;
  if (startRaw === '' && endRaw === '') return null;
  let start = startRaw === '' ? Math.max(0, size - Number(endRaw)) : Number(startRaw);
  let end = startRaw === '' || endRaw === '' ? size - 1 : Number(endRaw);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) return null;
  if (start >= size) return null;
  end = Math.min(end, size - 1);
  // Bound single responses so one request never streams an unbounded body.
  if (end - start + 1 > CHUNK_SIZE) end = start + CHUNK_SIZE - 1;
  return { start, end };
}

/**
 * Public read endpoint for uploaded journey videos.
 *
 * - The requested segments are joined back into a storage key and matched
 *   against an anchored video-only pattern before any filesystem access,
 *   so traversal attempts never reach the disk (image keys are rejected
 *   here — they are served by `/media/...` only).
 * - The MIME type comes from the MediaAsset row (recorded from magic
 *   bytes at upload time), never from the request, and
 *   `X-Content-Type-Options: nosniff` prevents content sniffing.
 * - Single-range requests (206) are honored so `<video>` seeking works;
 *   full responses (200) otherwise.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  const { path: segments } = await params;
  if (!Array.isArray(segments) || segments.length === 0) return notFound();

  const storageKey = segments.join('/');
  const asset = await getVideoAsset(storageKey).catch(() => null);
  if (!asset) return notFound();

  const filePath = resolveVideoPath(asset.storageKey);
  if (!filePath) return notFound();

  const info = await statVideoFile(asset.storageKey);
  if (!info) return notFound();

  const etag = `"${asset.id}-${info.size.toString(16)}"`;
  const baseHeaders = new Headers({
    'Content-Type': asset.mimeType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    ETag: etag,
    'Last-Modified': new Date(info.mtimeMs).toUTCString(),
  });

  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch && ifNoneMatch.split(',').some((tag) => tag.trim() === etag)) {
    return new Response(null, { status: 304, headers: baseHeaders });
  }

  const range = parseRange(request.headers.get('range'), info.size);
  if (range) {
    const { start, end } = range;
    const headers = new Headers(baseHeaders);
    headers.set('Content-Length', String(end - start + 1));
    headers.set('Content-Range', `bytes ${start}-${end}/${info.size}`);
    const stream = Readable.toWeb(
      // turbopackIgnore: reads happen at request time from MEDIA_STORAGE_DIR,
      // a runtime directory that must never be traced into the build output.
      createReadStream(/* turbopackIgnore: true */ filePath, { start, end }),
    ) as unknown as ReadableStream<Uint8Array>;
    return new Response(stream, { status: 206, headers });
  }

  const headers = new Headers(baseHeaders);
  headers.set('Content-Length', String(info.size));
  const stream = Readable.toWeb(
    // turbopackIgnore: reads happen at request time from MEDIA_STORAGE_DIR,
    // a runtime directory that must never be traced into the build output.
    createReadStream(/* turbopackIgnore: true */ filePath),
  ) as unknown as ReadableStream<Uint8Array>;
  return new Response(stream, { status: 200, headers });
}
