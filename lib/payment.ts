import { localeFromAr, pickLocaleText, type Locale } from '@/lib/locale-config'

/**
 * Payment contract (Phase 2F-A: payment core, provider-agnostic).
 *
 * The payment lifecycle is INDEPENDENT of the booking lifecycle: a
 * confirmed booking is NOT automatically paid. Money moves only
 * through server-side `Payment` records (`lib/server/payments.ts`);
 * the browser never supplies amounts, statuses, references, provider
 * IDs, or ownership. Amounts retain the stored currency in views; the
 * database stores DECIMAL and the server computes in integer cents.
 *
 * This module is intentionally neutral (no React, no storage): client
 * UI and the server service share statuses, transitions, labels, and
 * the Phase 2F-B provider-adapter interface shape.
 *
 * No gateway is integrated in Phase 2F-A. Initiation creates a
 * legitimate PENDING payment (intent placeholder) awaiting provider
 * handoff — never a paid record, never a success screen.
 */

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded'

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'pending',
  'processing',
  'paid',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded',
]

export type PaymentActor = 'customer' | 'staff' | 'system' | 'provider'

export type PaymentEventView = {
  at: string
  by: PaymentActor
  action: string
  note?: string
  /** Staff-only marker. Never set on customer-facing rows. */
  internal?: boolean
}

/** Server-issued payment view (MySQL-backed). Database IDs are never exposed. */
export type Payment = {
  reference: string
  bookingReference: string
  provider: string
  providerPaymentId: string | null
  status: PaymentStatus
  amount: number
  amountPaid: number
  amountRefunded: number
  currency: string
  failureCode: string | null
  failureMessage: string | null
  initiatedAt: string
  paidAt: string | null
  failedAt: string | null
  cancelledAt: string | null
  refundedAt: string | null
  createdAt: string
  updatedAt: string
  events: PaymentEventView[]
}

/** Staff view: everything customer-safe plus the linked account. */
export type StaffPayment = Payment & {
  account: { email: string; name: string } | null
}

/**
 * Derived booking payment summary computed from real Payment rows.
 * Bookings with no Payment record are `unpaid` — never fabricated.
 */
export type BookingPaymentSummary = {
  state: 'unpaid' | 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
  payments: number
  paidTotal: number
  /**
   * Verified refunded total (booking currency, server-computed from real
   * Payment rows). Present so customer/admin UIs can render paid,
   * refunded and remaining amounts without trusting client input.
   */
  refundedTotal: number
  latestReference: string | null
}

/**
 * Valid server-side payment transitions. Terminal states
 * (paid/refunded/cancelled) never leave except paid -> refunded /
 * partially_refunded via an audited refund workflow (Phase 2F-B).
 * NOTHING in Phase 2F-A performs these transitions — the map exists
 * so future provider webhooks and offline workflows share one rule.
 */
const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['processing', 'paid', 'failed', 'cancelled'],
  processing: ['paid', 'failed', 'cancelled'],
  paid: ['refunded', 'partially_refunded'],
  failed: ['pending'],
  cancelled: [],
  refunded: [],
  // Further partial returns remain partial until the captured amount is
  // fully returned. The server applies each delta under a payment-row lock.
  partially_refunded: ['partially_refunded', 'refunded'],
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false
}

/** USD display helper shared by customer and staff booking surfaces. */
export function remainingBookingBalance(total: number, paid: number, refunded: number): number {
  return Math.max(0, Math.round((total - (paid - refunded)) * 100) / 100)
}

/**
 * Maps a verified provider callback outcome to an internal payment
 * status. Only explicitly recognized outcomes produce a status:
 * anything else is 'unknown' and MUST be acknowledged without
 * mutation — never interpreted as cancellation.
 *
 * Refunds split on the settled amount: a refund covering the full
 * payment amount is 'refunded', anything less is
 * 'partially_refunded'. A missing refund amount defaults to the full
 * payment amount.
 */
export function mapProviderOutcomeToStatus(
  outcomeType: string,
  amountRefundedCents: number | undefined,
  paymentAmountCents: number,
): PaymentStatus | 'ignored' | 'unknown' {
  if (outcomeType === 'ignored') return 'ignored'
  if (outcomeType === 'paid') return 'paid'
  if (outcomeType === 'failed') return 'failed'
  if (outcomeType === 'refunded') {
    const refunded = amountRefundedCents ?? paymentAmountCents
    return refunded >= paymentAmountCents && paymentAmountCents > 0 ? 'refunded' : 'partially_refunded'
  }
  return 'unknown'
}

/** Integer minor-unit guard: finite integers at or above zero only. */
function isValidMinorUnits(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export type WebhookMoneyCheck = { ok: true } | { ok: false; reason: string }

/**
 * Fail-closed money validation for money-moving webhook outcomes.
 * Every comparison runs in integer minor units against the
 * authoritative STORED payment — never client-displayed totals:
 * - 'paid' requires the exact settled amount when `requireExactAmount`
 *   is on (under/over-payments are rejected, never marked PAID);
 * - 'refunded' requires a present, well-formed refund amount when
 *   `requireExactAmount` is on — any non-negative value is accepted
 *   here so legitimate partial refunds pass (the transition guard
 *   separately enforces refunded ≤ paid);
 * - 'failed' moves no money and carries no amount requirement;
 * - when `requireCurrency` is on, 'paid'/'refunded' outcomes must
 *   carry the stored currency (case-insensitive); 'failed' is exempt.
 * Reasons are safe metadata only (no payloads, no secrets).
 */
export function checkWebhookMoney(input: {
  outcomeType: string
  amountPaidCents?: unknown
  amountRefundedCents?: unknown
  outcomeCurrency?: unknown
  storedAmountCents: number
  storedCurrency: string
  requireExactAmount: boolean
  requireCurrency: boolean
}): WebhookMoneyCheck {
  const {
    outcomeType,
    amountPaidCents,
    amountRefundedCents,
    outcomeCurrency,
    storedAmountCents,
    storedCurrency,
    requireExactAmount,
    requireCurrency,
  } = input

  const checkCurrency = (): WebhookMoneyCheck => {
    if (!requireCurrency) return { ok: true }
    if (typeof outcomeCurrency !== 'string' || outcomeCurrency.trim() === '') {
      return { ok: false, reason: 'currency missing' }
    }
    if (outcomeCurrency.trim().toUpperCase() !== storedCurrency.trim().toUpperCase()) {
      return { ok: false, reason: 'currency mismatch' }
    }
    return { ok: true }
  }

  if (outcomeType === 'paid') {
    if (requireExactAmount) {
      if (amountPaidCents === undefined || amountPaidCents === null) {
        return { ok: false, reason: 'paid amount missing' }
      }
      if (!isValidMinorUnits(amountPaidCents)) {
        return { ok: false, reason: 'paid amount malformed' }
      }
      if (amountPaidCents !== storedAmountCents) {
        return { ok: false, reason: 'paid amount mismatch' }
      }
    }
    return checkCurrency()
  }

  if (outcomeType === 'refunded') {
    if (requireExactAmount) {
      if (amountRefundedCents === undefined || amountRefundedCents === null) {
        return { ok: false, reason: 'refund amount missing' }
      }
      if (!isValidMinorUnits(amountRefundedCents)) {
        return { ok: false, reason: 'refund amount malformed' }
      }
    }
    return checkCurrency()
  }

  return { ok: true }
}

/** Active attempt states: at most one per booking (idempotent initiation). */
export const ACTIVE_PAYMENT_STATUSES: readonly PaymentStatus[] = ['pending', 'processing']

/**
 * Customer-facing offline payment state for one booking (Phase 3: no
 * gateway, money moves only through staff-verified offline receipts).
 *
 * This is DISPLAY mapping over server-calculated amounts only — never
 * financial truth from client input. Booking lifecycle state (request
 * received / confirmed / completed / cancelled) stays separate in
 * `bookingStatusLabel`; the two are never mixed. A payment is labelled
 * paid/refunded only from verified Payment rows, never from a customer
 * proof submission.
 */
export function bookingOfflinePaymentLabel(
  input: { state: BookingPaymentSummary['state']; paidTotal: number; refundedTotal: number; total: number },
  ar: boolean | Locale,
): string {
  const locale = localeFromAr(ar)
  const paid = input.paidTotal
  const refunded = input.refundedTotal
  const net = paid - refunded
  if (input.state === 'refunded' || (paid > 0 && refunded >= paid)) {
    return pickLocaleText(locale, { en: 'Fully refunded', es: 'Reembolsado en su totalidad', it: 'Rimborsato integralmente', ar: 'مسترد بالكامل' })
  }
  if (input.state === 'partially_refunded' || refunded > 0) {
    return pickLocaleText(locale, { en: 'Partially refunded', es: 'Reembolsado parcialmente', it: 'Rimborsato parzialmente', ar: 'مسترد جزئيًا' })
  }
  if (input.total > 0 && paid >= input.total) {
    return pickLocaleText(locale, { en: 'Fully paid', es: 'Pagado en su totalidad', it: 'Pagato integralmente', ar: 'مدفوع بالكامل' })
  }
  if (net > 0) {
    return pickLocaleText(locale, { en: 'Partially paid', es: 'Pagado parcialmente', it: 'Pagato parzialmente', ar: 'مدفوع جزئيًا' })
  }
  return pickLocaleText(locale, { en: 'Awaiting payment', es: 'Pago pendiente', it: 'In attesa di pagamento', ar: 'بانتظار الدفع' })
}

/** Display strings are stored in English; UI maps them per locale. */
export function paymentStatusLabel(status: PaymentStatus, ar: boolean | Locale): string {
  const locale = localeFromAr(ar)
  switch (status) {
    case 'pending': return pickLocaleText(locale, { en: 'Pending', ar: 'قيد الانتظار' })
    case 'processing': return pickLocaleText(locale, { en: 'Processing', ar: 'جارٍ المعالجة' })
    case 'paid': return pickLocaleText(locale, { en: 'Paid', ar: 'مدفوع' })
    case 'failed': return pickLocaleText(locale, { en: 'Failed', ar: 'فشل الدفع' })
    case 'cancelled': return pickLocaleText(locale, { en: 'Cancelled', ar: 'ملغي' })
    case 'refunded': return pickLocaleText(locale, { en: 'Refunded', ar: 'مسترد' })
    case 'partially_refunded': return pickLocaleText(locale, { en: 'Partially refunded', ar: 'مسترد جزئيًا' })
  }
}

export function paymentActivityLabel(action: string, ar: boolean | Locale): string {
  const locale = localeFromAr(ar)
  if (locale === 'en') return action
  const map: Record<string, { ar?: string }> = {
    'Payment initiated': { ar: 'تم إنشاء الدفع' },
    'Payment handoff ready': { ar: 'الدفع جاهز للتحويل للمزود' },
    'Payment completed': { ar: 'اكتمل الدفع' },
    'Payment failed': { ar: 'فشل الدفع' },
    'Payment cancelled': { ar: 'تم إلغاء الدفع' },
    'Payment refunded': { ar: 'تم استرداد الدفع' },
    'Payment partially refunded': { ar: 'تم استرداد الدفع جزئيًا' },
  }
  const entry = map[action]
  if (!entry) return action
  return pickLocaleText(locale, { en: action, ...entry })
}

/**
 * Official reference shape for route params and links.
 * The backend issues `SP-PAY-XXXXXX`.
 */
const PAYMENT_REF_PATTERN = /^SP-PAY-[A-Z0-9]{6}$/
export const OFFICIAL_PAYMENT_REF_PATTERN = PAYMENT_REF_PATTERN

export function isPaymentReference(value: string): boolean {
  return PAYMENT_REF_PATTERN.test(value.trim())
}

/* ------------------------------------------------------------------ */
/* Phase 2F-B provider-adapter interface (contract only, no gateway).  */
/*                                                                     */
/* A future gateway plugs in by implementing `PaymentProviderAdapter`  */
/* and registering it server-side. The core never imports gateway      */
/* SDKs and never stores card numbers, CVV, or gateway credentials.    */
/* ------------------------------------------------------------------ */

export type PaymentProviderKey = string

/** Non-sensitive handoff payload a provider adapter returns. */
export type PaymentHandoff = {
  provider: PaymentProviderKey
  /** External reference issued by the provider (idempotency anchor). */
  providerPaymentId: string
  /** Provider-hosted redirect URL, when the flow leaves our site. */
  redirectUrl?: string
  /** Opaque non-sensitive provider payload (no card data, no secrets). */
  metadata?: Record<string, string>
}

/** Result of an inbound provider callback after signature verification. */
export type ProviderCallbackOutcome =
  | { type: 'paid'; amountPaidCents: number; currency?: string; providerPaymentId: string; metadata?: Record<string, string> }
  | { type: 'failed'; failureCode: string; failureMessage: string; providerPaymentId: string; currency?: string }
  | { type: 'refunded'; amountRefundedCents: number; currency?: string; providerPaymentId: string }
  | { type: 'ignored'; reason: string }

export interface PaymentProviderAdapter {
  readonly key: PaymentProviderKey
  /**
   * Start a provider-side checkout for an already-created PENDING
   * payment. MUST be idempotent on `payment.idempotencyKey`.
   */
  initiate(payment: { reference: string; amountCents: number; currency: 'USD'; idempotencyKey: string | null }): Promise<PaymentHandoff>
  /**
   * Verify and normalize an inbound provider webhook. Signature
   * verification happens here, before the core applies any change.
   */
  handleCallback(rawBody: string, headers: Headers): Promise<ProviderCallbackOutcome>
}
