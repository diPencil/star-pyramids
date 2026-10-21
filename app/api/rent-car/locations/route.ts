// Public: list ACTIVE chauffeur locations (Phase 2, read-only).
// Hidden locations never appear on public surfaces.
import { NextResponse } from 'next/server';

import { listActiveCarLocations } from '@/lib/server/car-pricing';

export async function GET() {
  const rows = await listActiveCarLocations();
  return NextResponse.json({
    locations: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      nameEn: row.nameEn,
      nameEs: row.nameEs,
      nameIt: row.nameIt,
      nameAr: row.nameAr,
      kind: row.kind,
      sortOrder: row.sortOrder,
    })),
  });
}
