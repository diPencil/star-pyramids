import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/server/csrf';
import { getAccountReadUser, getAccountWriteUser } from '@/lib/server/staff-preview';
import {
  addFavorite,
  listFavoriteSlugs,
  removeFavorite,
  validateFavorite,
} from '@/lib/server/favorites';

/** Owner-only saved-trip slugs (catalogue keys only, newest first). */
export async function GET() {
  const current = await getAccountReadUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const favorites = await listFavoriteSlugs(current.id);
  return NextResponse.json({ favorites });
}

/**
 * Owner-only save. The body carries a catalogue key ONLY — titles,
 * images, and prices always resolve live from the catalogue, never
 * from the browser. Re-saving is idempotent (no duplicates).
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await getAccountWriteUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  try {
    const favorites = await addFavorite(current.id, await validateFavorite(body));
    return NextResponse.json({ favorites }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

/**
 * Owner-only removal. Removing a non-saved item succeeds with the
 * current list — removal is idempotent by design.
 */
export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await getAccountWriteUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  try {
    const favorites = await removeFavorite(current.id, await validateFavorite(body));
    return NextResponse.json({ favorites });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
