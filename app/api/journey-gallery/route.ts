import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/server/csrf';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import {
  GalleryValidationError,
  createGalleryItem,
  listPublishedGallery,
  listGalleryItems,
  listTourGalleryItems,
  listGalleryTourChoices,
} from '@/lib/server/journey-gallery';

/**
 * Public gallery feeds (read-only, no auth required):
 * - `GET /api/journey-gallery` → published homepage items.
 * - `GET /api/journey-gallery?tour=<slug>` → published videos for one tour.
 * - `GET /api/journey-gallery?admin=1` → staff-only full list (drafts
 *   included) for the admin dashboard.
 *
 * Until the additive journey-gallery migration is applied, public reads
 * degrade to an empty feed (storefronts fall back to legacy content)
 * while staff surfaces report 503 instead of masking the state.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tourSlug = params.get('tour')?.trim() || null;
  const adminList = params.get('admin') === '1';
  if (params.get('tourChoices') === '1') {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    if (!['gallery.view', 'gallery.create', 'gallery.edit'].some(key => hasPermission(user, key))) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    try { return NextResponse.json({ tours: await listGalleryTourChoices() }, { headers: { 'Cache-Control': 'private, no-store' } }); }
    catch { return NextResponse.json({ error: 'Could not load tour choices.' }, { status: 503 }); }
  }
  if (tourSlug && tourSlug.length > 80) return NextResponse.json({ error: 'Invalid tour.' }, { status: 400 });

  if (adminList) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    if (!hasPermission(user, 'gallery.view')) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
    try {
      return NextResponse.json({ items: await listGalleryItems() });
    } catch (error) {
      console.error('Journey gallery admin list failed:', error);
      return NextResponse.json(
        { error: 'Journey gallery tables are not available yet. Apply the pending migration.' },
        { status: 503 },
      );
    }
  }

  try {
    if (tourSlug) {
      return NextResponse.json({ items: await listTourGalleryItems(tourSlug) });
    }
    return NextResponse.json({ items: await listPublishedGallery() });
  } catch (error) {
    console.error('Journey gallery public feed failed:', error);
    return NextResponse.json({ items: [], unavailable: true });
  }
}

export async function POST(request: Request) {
  // Staff-only create with same-origin mutation protection
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'gallery.create')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  try {
    const item = await createGalleryItem((data ?? {}) as Record<string, unknown>);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof GalleryValidationError) {
      const status = error.message.includes('already in the gallery') ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error('Journey gallery create failed:', error);
    return NextResponse.json(
      { error: 'Could not save that gallery item. Apply the pending migration if this persists.' },
      { status: 503 },
    );
  }
}
