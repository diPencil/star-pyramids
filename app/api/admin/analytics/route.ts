import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { AnalyticsValidationError, getAnalytics, parseAnalyticsRange } from '@/lib/server/analytics';

/**
 * Phase 4G: real dashboard analytics from database records.
 *
 * Read-only aggregates with functional `from`/`to` date-range
 * filtering (YYYY-MM-DD, inclusive, max 731 days; defaults to the
 * trailing 90 days).
 *
 * Tiered authorization on the existing permission system:
 * - Unauthenticated -> 401.
 * - No `bookings.view` and no `payments.view` -> 403 (CUSTOMER
 *   accounts hold zero grants and are always rejected).
 * - `bookings.view` without `payments.view` -> operational figures
 *   only; collected revenue, refunds, outstanding balances and the
 *   revenue trend are withheld (`financial: false`) and the dashboard
 *   renders a restricted state instead of zeros.
 * - `payments.view` (ADMIN/STAFF/SUPER_ADMIN) -> full response.
 * No new permissions are granted and no grant is weakened.
 */
export async function GET(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const canViewBookings = hasPermission(current, 'bookings.view');
  const canViewFinancial = hasPermission(current, 'payments.view');
  if (!canViewBookings && !canViewFinancial) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  let range: ReturnType<typeof parseAnalyticsRange>;
  try {
    range = parseAnalyticsRange(new URL(request.url).searchParams);
  } catch (error) {
    if (error instanceof AnalyticsValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const analytics = await getAnalytics(range, { includeFinancial: canViewFinancial });
  return NextResponse.json(analytics);
}
