import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/server/csrf';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import {
  GalleryNotFoundError,
  GalleryValidationError,
  deleteGalleryItem,
  getGalleryItem,
  updateGalleryItem,
} from '@/lib/server/journey-gallery';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Staff-only single-item read for the admin editor (drafts included).
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'gallery.view')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const item = await getGalleryItem(id);
    if (!item) return NextResponse.json({ error: 'Gallery item not found.' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    console.error('Journey gallery read failed:', error);
    return NextResponse.json({ error: 'Could not load that gallery item.' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Staff-only edit with same-origin mutation protection
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'gallery.edit')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const { id } = await params;
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  try {
    const item = await updateGalleryItem(id, (data ?? {}) as Record<string, unknown>);
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof GalleryNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof GalleryValidationError) {
      const status = error.message.includes('already in the gallery') ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error('Journey gallery update failed:', error);
    return NextResponse.json({ error: 'Could not save that gallery item.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Staff-only delete with same-origin mutation protection
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasPermission(user, 'gallery.delete')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const { id } = await params;
  try {
    await deleteGalleryItem(id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof GalleryNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('Journey gallery delete failed:', error);
    return NextResponse.json({ error: 'Could not delete that gallery item.' }, { status: 500 });
  }
}
