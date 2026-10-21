// Public: list ACTIVE routes between ACTIVE locations (Phase 2, read-only).
// Directional: A→B and B→A are distinct entries with independent pricing.
import { NextResponse } from 'next/server';

import { listActiveCarRoutes } from '@/lib/server/car-pricing';

export async function GET() {
  const rows = await listActiveCarRoutes();
  return NextResponse.json({
    routes: rows.map((row) => ({
      id: row.id,
      origin: {
        slug: row.origin.slug,
        nameEn: row.origin.nameEn,
        nameEs: row.origin.nameEs,
        nameIt: row.origin.nameIt,
        nameAr: row.origin.nameAr,
        kind: row.origin.kind,
      },
      destination: {
        slug: row.destination.slug,
        nameEn: row.destination.nameEn,
        nameEs: row.destination.nameEs,
        nameIt: row.destination.nameIt,
        nameAr: row.destination.nameAr,
        kind: row.destination.kind,
      },
      sortOrder: row.sortOrder,
    })),
  });
}
