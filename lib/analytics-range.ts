// Dashboard analytics date-range parsing (framework-free).
//
// Extracted verbatim from `lib/server/analytics.ts` so the range-window
// contract — inclusive YYYY-MM-DD days, full 00:00 → next-00:00 day
// windows shared by every KPI and chart query — is unit-testable without
// a database. The server module re-exports this; behavior is unchanged.

import type { AnalyticsRange } from '@/lib/analytics';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 731;
const DAY_MS = 24 * 60 * 60 * 1000;

export class AnalyticsValidationError extends Error {
  status = 400 as const;
}

function parseDay(value: string | null, name: string): Date {
  if (!value || !DATE_PATTERN.test(value)) {
    throw new AnalyticsValidationError(`Select a valid ${name} date (YYYY-MM-DD).`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new AnalyticsValidationError(`Select a valid ${name} date (YYYY-MM-DD).`);
  }
  return date;
}

/**
 * Strict range parsing for the analytics API. Defaults to the trailing
 * 90 days. Ranges are capped so bucketed series stay bounded.
 *
 * A same-day range (`from === to`) covers the full 24h day:
 * `start` is 00:00:00.000Z and `endExclusive` is the next 00:00:00.000Z,
 * so every consumer filtering with `gte: start, lt: endExclusive`
 * (bookings, payments, customers, lines, requests, enquiries, reviews)
 * sees the whole day — 00:00 through end of day.
 */
export function parseAnalyticsRange(search: URLSearchParams): AnalyticsRange & { start: Date; endExclusive: Date } {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const defaultFrom = new Date(today.getTime() - 89 * DAY_MS).toISOString().slice(0, 10);
  const fromKey = search.get('from') ?? defaultFrom;
  const toKey = search.get('to') ?? todayKey;
  const start = parseDay(fromKey, 'start');
  const endDay = parseDay(toKey, 'end');
  if (start.getTime() > endDay.getTime()) {
    throw new AnalyticsValidationError('The start date must be on or before the end date.');
  }
  const days = Math.round((endDay.getTime() - start.getTime()) / DAY_MS) + 1;
  if (days > MAX_RANGE_DAYS) {
    throw new AnalyticsValidationError(`Date ranges are limited to ${MAX_RANGE_DAYS} days.`);
  }
  return { from: fromKey, to: toKey, start, endExclusive: new Date(endDay.getTime() + DAY_MS) };
}
