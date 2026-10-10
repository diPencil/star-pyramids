import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  MediaUploadError,
  checkMediaUploadRateLimit,
  storeUploadedImage,
  type MediaScope,
} from '@/lib/server/media';

// Multipart uploads are read by the Node.js stream parser; the Edge runtime
// has no `File`/`FormData` body support for this path.
export const runtime = 'nodejs';

/**
 * Permissions required per scope.
 * - `avatar`: any signed-in user (customers upload their own photo).
 * - `brand`: logo/favicon are system settings.
 * - `catalogue`: staff who may edit any catalogue surface that shows an
 *   image field (tours, offers, destinations, blogs, events, vehicles and
 *   multi-day categories).
 */
const SCOPE_PERMISSIONS: Readonly<Record<MediaScope, readonly string[]>> = {
  avatar: [],
  brand: ['settings.edit'],
  catalogue: [
    'tours.create',
    'tours.edit',
    'cars.create',
    'cars.edit',
    'destinations.create',
    'destinations.edit',
    'offers.create',
    'offers.edit',
    'blogs.create',
    'blogs.edit',
    'events.create',
    'events.edit',
    'categories.create',
    'categories.edit',
  ],
};

function parseScope(value: unknown): MediaScope | null {
  return value === 'avatar' || value === 'brand' || value === 'catalogue' ? value : null;
}

/**
 * Canonical image-upload endpoint. Returns the stored public URL, which is
 * what every image field in the admin and account areas now persists
 * instead of a Base64 data URL.
 *
 * The caller supplies only a `scope` label — never a path, filename or
 * destination. Filenames are generated server-side from CSPRNG bytes, so a
 * crafted name cannot traverse directories, collide, or overwrite an
 * existing image.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 });
  }

  const scope = parseScope(form.get('scope'));
  if (!scope) {
    return NextResponse.json({ error: 'Invalid upload scope.' }, { status: 400 });
  }

  const required = SCOPE_PERMISSIONS[scope];
  if (required.length > 0 && !required.some((key) => hasPermission(current, key))) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose an image file to upload.' }, { status: 400 });
  }

  const limit = await checkMediaUploadRateLimit(current.id);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many uploads. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const media = await storeUploadedImage({ file, scope, uploaderId: current.id });
    return NextResponse.json({ media }, { status: 201 });
  } catch (error) {
    if (error instanceof MediaUploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Media upload failed:', error);
    return NextResponse.json({ error: 'Could not save that image.' }, { status: 500 });
  }
}