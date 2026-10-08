// Phase 4G: shared analytics contracts (client + server).
//
// Financial rules enforced by every consumer:
// - Revenue means successfully collected payments ONLY (PAID,
//   PARTIALLY_REFUNDED net of refunds, REFUNDED contributes net zero).
//   Booking totals are reported separately as volume — never as revenue.
// - PENDING, PROCESSING, FAILED and CANCELLED payments are excluded
//   from collected figures. Outstanding balances cover PENDING /
//   PROCESSING payments on non-cancelled bookings only.
// - Currencies are never mixed and never converted: every money figure
//   is reported per currency. No exchange rates are fabricated.

export type AnalyticsGranularity = 'day' | 'week' | 'month';

export interface AnalyticsRange {
  /** Inclusive start, YYYY-MM-DD. */
  from: string;
  /** Inclusive end, YYYY-MM-DD. */
  to: string;
}

export interface MoneyByCurrency {
  currency: string;
  amount: number;
}

export interface AnalyticsKpis {
  /** Net collected per currency (amountPaid minus amountRefunded). */
  collected: MoneyByCurrency[];
  /** Payments contributing to collected (PAID / PARTIALLY_REFUNDED / REFUNDED). */
  collectedPayments: number;
  /** Refunded money per currency (informational, already netted above). */
  refunded: MoneyByCurrency[];
  /** Remaining amounts on PENDING/PROCESSING payments of non-cancelled bookings. */
  outstanding: MoneyByCurrency[];
  outstandingPayments: number;
  /** Sum of booking totals per currency (commercial volume, NOT revenue). */
  bookingVolume: MoneyByCurrency[];
  bookings: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
  newCustomers: number;
  /** Booking lines in non-cancelled bookings created in range. */
  tripsSold: number;
  /**
   * Percent change vs the previous equal-length period.
   * `null` means "New" — the previous period was empty while the
   * current period is not, so no meaningful percentage exists.
   * `0` is kept only when both periods are zero.
   */
  deltas: {
    revenuePct: number | null;
    bookingsPct: number | null;
    customersPct: number | null;
    tripsPct: number | null;
  };
}

export interface RevenuePoint {
  label: string;
  full: string;
  revenue: number;
  payments: number;
}

export interface AnalyticsResponse {
  range: AnalyticsRange;
  generatedAt: string;
  /**
   * True when the caller holds `payments.view` and financial figures
   * (collected revenue, refunds, outstanding balances, revenue trend)
   * are included. Otherwise those fields are empty/zero and the
   * dashboard must render a restricted state — never zeros as fact.
   */
  financial: boolean;
  kpis: AnalyticsKpis;
  /** Booked counts per calendar month overlapping the range. */
  bookingMonthly: Array<{ month: string; booked: number }>;
  /** Sold lines per tour category (non-cancelled bookings in range); delta null means "New". */
  tourSplit: Array<{ label: string; value: number; delta: number | null }>;
  tourSplitTotal: number;
  /** Real collected-revenue series for trailing windows. */
  trend: {
    monthly: RevenuePoint[];
    weekly: RevenuePoint[];
    daily: RevenuePoint[];
  };
  /** Bookings created in range grouped by customer country. */
  markets: Array<{ country: string; bookings: number }>;
  topTours: Array<{
    slug: string;
    title: string;
    lines: number;
    volume: number;
    currency: string;
  }>;
  pipeline: {
    tripRequests: { total: number; byStatus: Record<string, number> };
    carRequests: { total: number; byStatus: Record<string, number> };
    eventRequests: { total: number; byStatus: Record<string, number> };
    enquiries: { total: number; byStatus: Record<string, number> };
    reviews: {
      total: number;
      pending: number;
      published: number;
      rejected: number;
      averageRating: number | null;
    };
    customers: { total: number; newInRange: number };
  };
}
