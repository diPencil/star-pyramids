import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  MediaUploadError,
  storeUploadedImage,
} from '@/lib/server/media';
import { toClientUser, updateUserAvatar } from '@/lib/server/users';

export const runtime = 'nodejs';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * Sets the signed-in user's own avatar. No user id is ever read from the
 * request body, so an account can only ever change its own photo.
 *
 * Two accepted shapes:
 * - `multipart/form-data` with a `file` part: the image is stored as a real
 *   media file and the returned public URL is persisted. This is the flow
 *   the account UI uses.
 * - `application/json` with `{ avatar }`: an existing http(s) URL or a
 *   legacy data URL, kept so records saved before server-side media
 *   storage keep working.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 });
    }
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Avatar is required.' }, { status: 400 });
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return NextResponse.json({ error: 'Image exceeds 2MB limit.' }, { status: 400 });
    }
    try {
      const media = await storeUploadedImage({
        file,
        scope: 'avatar',
        uploaderId: current.id,
      });
      const user = await updateUserAvatar(current.id, media.url);
      return NextResponse.json({ user: toClientUser(user), url: media.url });
    } catch (error) {
      if (error instanceof MediaUploadError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      console.error('Avatar upload failed:', error);
      return NextResponse.json({ error: 'Failed to save avatar.' }, { status: 500 });
    }
  }

  let body: { avatar?: unknown };
  try {
    body = await request.json() as { avatar?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const avatar = typeof body.avatar === 'string' ? body.avatar.trim() : '';

  if (!avatar) {
    return NextResponse.json({ error: 'Avatar is required.' }, { status: 400 });
  }

  // Validate avatar: either a valid URL, a stored media path, or a
  // legacy data URL kept for records saved before media storage existed.
  const isDataUrl = avatar.startsWith('data:image/');
  const isUrl = /^https?:\/\/.+/i.test(avatar);
  const isStoredMedia = /^\/media\/\d{4}\/\d{2}\/[0-9a-f]{32}\.(?:jpg|png|webp|gif)$/i.test(avatar);

  if (!isDataUrl && !isUrl && !isStoredMedia) {
    return NextResponse.json({ error: 'Avatar must be a valid image URL or data URL.' }, { status: 400 });
  }

  // Legacy data URLs are still size-checked (roughly 1.5MB limit). Uploaded
  // files are bounded by the media store, not here.
  if (isDataUrl) {
    const base64Length = avatar.length;
    const approxBytes = base64Length * 0.75;
    if (approxBytes > 1_500_000) {
      return NextResponse.json({ error: 'Image exceeds 1.5MB limit.' }, { status: 400 });
    }
  }

  try {
    const user = await updateUserAvatar(current.id, avatar);
    return NextResponse.json({ user: toClientUser(user) });
  } catch (error) {
    console.error('Avatar update failed:', error);
    return NextResponse.json({ error: 'Failed to save avatar.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const user = await updateUserAvatar(current.id, null);
    return NextResponse.json({ user: toClientUser(user) });
  } catch (error) {
    console.error('Avatar delete failed:', error);
    return NextResponse.json({ error: 'Failed to remove avatar.' }, { status: 500 });
  }
}