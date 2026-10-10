// Phase 4G: dashboard analytics service. All figures derive from real
// database records via aggregation-friendly queries — no mocks, no
// samples. See lib/analytics.ts for the shared financial rules.
import 'server-only';

import { countries } from '@/data/countries';
import type {
  AnalyticsKpis,
  AnalyticsRange,
  AnalyticsResponse,
  MoneyByCurrency,
} from '@/lib/analytics';

import { db } from './db';
import { revenueSeries } from '@/lib/revenue-periods';
import {
  AnalyticsValidationError,
  parseAnalyticsRange,
} from '@/lib/analytics-range';

export { AnalyticsValidationError, parseAnalyticsRange };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Payments that contribute collected money (net of refunds). */
const COLLECTED_STATUSES = ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] as const;
/** Payments that can still settle (on non-cancelled bookings). */
const OUTSTANDING_STATUSES = ['PENDING', 'PROCESSING'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  'one-day-tours': 'One-Day Tours',
  'multi-days-tours': 'Multi-Days Tours',
  'nile-cruises': 'Nile Cruises',
  'shore-excursions': 'Shore Excursions',
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Integer-cents helpers: money is summed in cents, never floats. */
function toCents(value: unknown): number {
  return Math.round(Number(String(value)) * 100);
}

function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}

function groupCents(rows: Array<{ currency: string; cents: number }>): MoneyByCurrency[] {
  const sums = new Map<string, number>();
  for (const row of rows) sums.set(row.currency, (sums.get(row.currency) ?? 0) + row.cents);
  return [...sums.entries()]
    .map(([currency, cents]) => ({ currency, amount: centsToAmount(cents) }))
    .sort((a, b) => (a.currency < b.currency ? -1 : 1));
}

/** Percent change vs a previous equal-length window. Returns null
 *  ("New") when the previous window is empty but the current is not —
 *  no meaningful percentage exists. Returns 0 only when both are zero. */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100 * 100) / 100;
}

/**
 * Dominant currency for single-number revenue deltas: USD when present
 * in either window, else the currency with the highest current net.
 * Per-currency nets are always reported in full — the delta currency is
 * a display convenience only, never a conversion.
 */
function deltaCurrency(current: MoneyByCurrency[], previous: MoneyByCurrency[]): string {
  const codes = new Set([...current.map((m) => m.currency), ...previous.map((m) => m.currency)]);
  if (codes.has('USD')) return 'USD';
  let best = '';
  let bestNet = -Infinity;
  for (const row of current) {
    if (row.amount > bestNet) {
      bestNet = row.amount;
      best = row.currency;
    }
  }
  if (best) return best;
  const first = previous[0]?.currency;
  return first ?? 'USD';
}

function netFor(rows: MoneyByCurrency[], currency: string): number {
  return rows.find((row) => row.currency === currency)?.amount ?? 0;
}

const countryName = (() => {
  const map = new Map(countries.map((c) => [c.code.toUpperCase(), c.name]));
  return (code: string | null | undefined): string => {
    if (!code) return 'Guest checkout';
    return map.get(code.toUpperCase()) ?? code.toUpperCase();
  };
})();

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const month = Number(key.slice(5, 7));
  return MONTH_SHORT[month - 1] ?? key;
}

function enumerateMonths(start: Date, endExclusive: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor.getTime() < endExclusive.getTime()) {
    keys.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    if (keys.length > 25) break;
  }
  return keys;
}

type CollectedRow = {
  currency: string;
  paidAt: Date | null;
  createdAt: Date;
  netCents: number;
  refundedCents: number;
};

export interface AnalyticsOptions {
  /**
   * Include restricted financial figures (collected revenue, refunds,
   * outstanding balances, revenue trend). False for callers without
   * `payments.view` — financial fields come back empty/zero with
   * `financial: false` so the UI renders "Restricted", never fake zeros.
   */
  includeFinancial?: boolean;
}

export async function getAnalytics(
  range: { start: Date; endExclusive: Date; from: string; to: string },
  options: AnalyticsOptions = {},
): Promise<AnalyticsResponse> {
  const includeFinancial = options.includeFinancial ?? true;
  const { start, endExclusive } = range;
  const spanMs = endExclusive.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - spanMs);
  const prevEnd = start;

  const inRange = { gte: start, lt: endExclusive };
  const inPrev = { gte: prevStart, lt: prevEnd };

  const [
    bookings,
    prevBookings,
    contributing,
    outstandingRows,
    customersTotal,
    customersNew,
    customersPrev,
    lines,
    prevLines,
    prevLineSlugs,
    tripRequests,
    carRequests,
    eventRequests,
    enquiries,
    reviews,
    trendPayments,
  ] = await Promise.all([
    db.booking.findMany({
      where: { createdAt: inRange },
      select: { status: true, currency: true, total: true, createdAt: true },
    }),
    db.booking.findMany({
      where: { createdAt: inPrev },
      select: { status: true, currency: true, total: true },
    }),
    // Financial reads are skipped entirely for callers without
    // `payments.view` — restricted figures must never leave the server.
    includeFinancial
      ? db.payment.findMany({
          // Collected set for the current + previous windows (collection
          // date is paidAt with a createdAt fallback, applied in code).
          where: {
            status: { in: [...COLLECTED_STATUSES] },
            OR: [
              { paidAt: { gte: prevStart, lt: endExclusive } },
              { paidAt: null, createdAt: { gte: prevStart, lt: endExclusive } },
            ],
          },
          select: { currency: true, amountPaid: true, amountRefunded: true, paidAt: true, createdAt: true },
        })
      : Promise.resolve([]),
    includeFinancial
      ? db.payment.findMany({
          where: {
            status: { in: [...OUTSTANDING_STATUSES] },
            booking: { status: { not: 'CANCELLED' } },
          },
          select: { currency: true, amount: true, amountPaid: true },
        })
      : Promise.resolve([]),
    db.user.count({ where: { roles: { some: { role: { key: 'CUSTOMER' } } } } }),
    db.user.count({
      where: { roles: { some: { role: { key: 'CUSTOMER' } } }, createdAt: inRange },
    }),
    db.user.count({
      where: { roles: { some: { role: { key: 'CUSTOMER' } } }, createdAt: inPrev },
    }),
    db.bookingItem.findMany({
      where: { booking: { createdAt: inRange, status: { not: 'CANCELLED' } } },
      select: {
        tourSlug: true,
        tourTitle: true,
        lineTotal: true,
        booking: { select: { currency: true } },
      },
    }),
    db.bookingItem.count({
      where: { booking: { createdAt: inPrev, status: { not: 'CANCELLED' } } },
    }),
    db.bookingItem.findMany({
      where: { booking: { createdAt: inPrev, status: { not: 'CANCELLED' } } },
      select: { tourSlug: true },
    }),
    db.tripRequest.findMany({ where: { createdAt: inRange }, select: { status: true } }),
    db.carRequest.findMany({ where: { createdAt: inRange }, select: { status: true } }),
    db.eventRequest.findMany({ where: { createdAt: inRange }, select: { status: true } }),
    db.websiteEnquiry.findMany({ where: { createdAt: inRange }, select: { status: true } }),
    db.review.findMany({ where: { createdAt: inRange }, select: { status: true, rating: true } }),
    includeFinancial
      ? db.payment.findMany({
          // Include uncollected dates for coverage, but never their amounts
          // or counts in the collected-revenue series.
          select: { status: true, currency: true, amountPaid: true, amountRefunded: true, paidAt: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  const toCollected = (rows: typeof contributing): CollectedRow[] =>
    rows.map((p) => ({
      currency: p.currency,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      netCents: toCents(p.amountPaid) - toCents(p.amountRefunded),
      refundedCents: toCents(p.amountRefunded),
    }));

  const collectedRows = toCollected(contributing).filter((p) => {
    const at = (p.paidAt ?? p.createdAt).getTime();
    return at >= start.getTime() && at < endExclusive.getTime();
  });
  const prevCollectedRows = toCollected(contributing).filter((p) => {
    const at = (p.paidAt ?? p.createdAt).getTime();
    return at >= prevStart.getTime() && at < prevEnd.getTime();
  });

  const collected = groupCents(collectedRows.map((p) => ({ currency: p.currency, cents: p.netCents })));
  const prevCollected = groupCents(prevCollectedRows.map((p) => ({ currency: p.currency, cents: p.netCents })));
  const refunded = groupCents(
    collectedRows.filter((p) => p.refundedCents > 0).map((p) => ({ currency: p.currency, cents: p.refundedCents })),
  );
  const outstanding = groupCents(
    outstandingRows
      .map((p) => ({ currency: p.currency, cents: toCents(p.amount) - toCents(p.amountPaid) }))
      .filter((row) => row.cents > 0),
  );
  const outstandingPayments = outstandingRows.filter(
    (p) => toCents(p.amount) - toCents(p.amountPaid) > 0,
  ).length;

  // Booked volume covers live demand only: cancelled bookings are
  // reported in the status breakdown, never in commercial volume.
  const bookingVolume = groupCents(
    bookings
      .filter((b) => b.status !== 'CANCELLED')
      .map((b) => ({ currency: b.currency, cents: toCents(b.total) })),
  );

  const countStatus = (rows: Array<{ status: string }>, status: string): number =>
    rows.filter((row) => row.status === status).length;

  const bookingsSummary = {
    total: bookings.length,
    pending: countStatus(bookings, 'PENDING'),
    confirmed: countStatus(bookings, 'CONFIRMED'),
    completed: countStatus(bookings, 'COMPLETED'),
    cancelled: countStatus(bookings, 'CANCELLED'),
  };

  const deltaCcy = deltaCurrency(collected, prevCollected);
  const deltas: AnalyticsKpis['deltas'] = {
    revenuePct: includeFinancial ? pctChange(netFor(collected, deltaCcy), netFor(prevCollected, deltaCcy)) : null,
    bookingsPct: pctChange(bookings.length, prevBookings.length),
    customersPct: pctChange(customersNew, customersPrev),
    tripsPct: pctChange(lines.length, prevLines),
  };

  // Monthly booking counts for months overlapping the range.
  const monthCounts = new Map<string, number>();
  for (const key of enumerateMonths(start, endExclusive)) monthCounts.set(key, 0);
  for (const booking of bookings) {
    const key = monthKey(booking.createdAt);
    if (monthCounts.has(key)) monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const bookingMonthly = [...monthCounts.entries()].map(([key, booked]) => ({
    month: monthLabel(key),
    booked,
  }));

  // Tour split: sold lines grouped by DB catalogue category, with
  // real previous-window deltas per category.
  const slugs = [...new Set([...lines.map((line) => line.tourSlug), ...prevLineSlugs.map((line) => line.tourSlug)])];
  const tourRows = slugs.length
    ? await db.tour.findMany({ where: { slug: { in: slugs } }, select: { slug: true, title: true, category: true } })
    : [];
  const tourBySlug = new Map(tourRows.map((tour) => [tour.slug, tour]));
  const splitCounts = new Map<string, number>();
  for (const line of lines) {
    const category = tourBySlug.get(line.tourSlug)?.category ?? 'other';
    splitCounts.set(category, (splitCounts.get(category) ?? 0) + 1);
  }
  const prevSplitCounts = new Map<string, number>();
  for (const line of prevLineSlugs) {
    const category = tourBySlug.get(line.tourSlug)?.category ?? 'other';
    prevSplitCounts.set(category, (prevSplitCounts.get(category) ?? 0) + 1);
  }
  const tourSplit = [...splitCounts.entries()]
    .map(([category, value]) => ({
      label: CATEGORY_LABELS[category] ?? 'Other tours',
      value,
      delta: pctChange(value, prevSplitCounts.get(category) ?? 0),
    }))
    .sort((a, b) => b.value - a.value);

  // Top tours by sold lines (titles prefer the DB catalogue, falling
  // back to the frozen checkout snapshot for removed tours).
  const linesBySlug = new Map<string, { title: string; lines: number; volumeCents: number; currency: string }>();
  for (const line of lines) {
    const known = tourBySlug.get(line.tourSlug);
    const entry = linesBySlug.get(line.tourSlug) ?? {
      title: known?.title ?? line.tourTitle,
      lines: 0,
      volumeCents: 0,
      currency: line.booking.currency,
    };
    entry.lines += 1;
    if (entry.currency === line.booking.currency) {
      entry.volumeCents += toCents(line.lineTotal);
    }
    linesBySlug.set(line.tourSlug, entry);
  }
  const topTours = [...linesBySlug.entries()]
    .map(([slug, entry]) => ({
      slug,
      title: entry.title,
      lines: entry.lines,
      volume: centsToAmount(entry.volumeCents),
      currency: entry.currency,
    }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 5);

  // Markets: bookings in range grouped by the owning customer's country.
  const bookingUserIds = await db.booking.findMany({
    where: { createdAt: inRange },
    select: { userId: true },
  });
  const linkedIds = [...new Set(bookingUserIds.map((b) => b.userId).filter((id): id is string => id !== null))];
  const linkedUsers = linkedIds.length
    ? await db.user.findMany({ where: { id: { in: linkedIds } }, select: { id: true, countryCode: true } })
    : [];
  const countryByUser = new Map(linkedUsers.map((u) => [u.id, u.countryCode]));
  const marketCounts = new Map<string, number>();
  for (const booking of bookingUserIds) {
    const label = countryName(booking.userId ? countryByUser.get(booking.userId) : null);
    marketCounts.set(label, (marketCounts.get(label) ?? 0) + 1);
  }
  const markets = [...marketCounts.entries()]
    .map(([country, bookingCount]) => ({ country, bookings: bookingCount }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 6);

  const byStatus = (rows: Array<{ status: string }>): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  };

  const publishedRatings = reviews.filter((r) => r.status === 'PUBLISHED').map((r) => r.rating);
  const averageRating =
    publishedRatings.length > 0
      ? Math.round((publishedRatings.reduce((s, r) => s + r, 0) / publishedRatings.length) * 100) / 100
      : null;

  const trendRows = toCollected(trendPayments.filter((row) => COLLECTED_STATUSES.some((status) => status === row.status))).map((row) => ({ at: (row.paidAt ?? row.createdAt).getTime(), cents: row.netCents }));
  const trendStart = trendRows.length > 0
    ? trendRows.reduce((at, row) => Math.min(at, row.at), trendRows[0].at)
    : Date.now();

  const currentYear = new Date().getUTCFullYear();
  const trendStartYear = trendRows.length > 0 ? new Date(trendStart).getUTCFullYear() : currentYear;

  return {
    range: { from: range.from, to: range.to },
    generatedAt: new Date().toISOString(),
    financial: includeFinancial,
    trendStartYear,
    currentYear,
    kpis: {
      collected,
      collectedPayments: collectedRows.length,
      refunded,
      outstanding,
      outstandingPayments,
      bookingVolume,
      bookings: bookingsSummary,
      newCustomers: customersNew,
      tripsSold: lines.length,
      deltas,
    },
    bookingMonthly,
    tourSplit,
    tourSplitTotal: lines.length,
    trend: {
      monthly: includeFinancial ? revenueSeries(trendRows, 'months', Date.now(), trendStart) : [],
      weekly: includeFinancial ? revenueSeries(trendRows, 'weeks', Date.now(), trendStart) : [],
      daily: includeFinancial ? revenueSeries(trendRows, 'days', Date.now(), trendStart) : [],
    },
    markets,
    topTours,
    pipeline: {
      tripRequests: { total: tripRequests.length, byStatus: byStatus(tripRequests) },
      carRequests: { total: carRequests.length, byStatus: byStatus(carRequests) },
      eventRequests: { total: eventRequests.length, byStatus: byStatus(eventRequests) },
      enquiries: { total: enquiries.length, byStatus: byStatus(enquiries) },
      reviews: {
        total: reviews.length,
        pending: countStatus(reviews, 'PENDING'),
        published: countStatus(reviews, 'PUBLISHED'),
        rejected: countStatus(reviews, 'REJECTED'),
        averageRating,
      },
      customers: { total: customersTotal, newInRange: customersNew },
    },
  };
}
