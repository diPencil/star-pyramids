import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/server/csrf';
import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { GalleryValidationError, reorderGalleryItems } from '@/lib/server/journey-gallery';

/** Staff-only atomic reorder: `{ order: [{ id, sortOrder }] }`. */
export async function POST(request: Request) {
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

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const order = (data as { order?: unknown } | null)?.order;

  try {
    await reorderGalleryItems(
      (Array.isArray(order) ? order : []) as Array<{ id: string; sortOrder: number }>,
    );
    return NextResponse.json({ reordered: true });
  } catch (error) {
    if (error instanceof GalleryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Journey gallery reorder failed:', error);
    return NextResponse.json({ error: 'Could not reorder gallery items.' }, { status: 500 });
  }
}
