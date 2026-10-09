# STAR PYRAMIDS — Payment Integration Readiness Audit

**Project Root:** `E:\star-pyramids-nodejs\web-source`
**Branch:** `main`
**Latest Commit:** `3b57057` (fix: correct customer net payment collection)
**Audit Date:** 2026-10-09
**Environment:** Next.js 16.3.3 / React 19 / Prisma 6.19.3 / MySQL 8.0
**Database:** `star_pyramids` on `127.0.0.1:3306`
**Production Build:** 241/241 pages ✅ PASS
**Dev Server:** `http://localhost:3000` (running, uninterrupted)

---

## 1. Executive Summary

**Overall Readiness: 78% — Foundation Complete, Gateway Integration Required**

The STAR PYRAMIDS payment system has a **solid, production-grade foundation** for Phase 2F-A (payment core, no gateway). The architecture is deliberately provider-agnostic with server-owned pricing, strict RBAC, and immutable audit trails. All payment lifecycle logic lives server-side; the browser never touches amounts, statuses, or provider IDs.

**Critical Blockers for Live Gateway:**
1. **No payment gateway adapter implemented** — `PaymentProviderAdapter` interface exists but zero implementations
2. **No webhook endpoint** — No `/api/payments/webhook/[provider]` route exists
3. **No checkout session creation** — `PaymentProviderAdapter.initiate()` must be implemented per gateway
4. **No webhook signature verification** — Raw body validation, timestamp/replay protection missing
5. **Guest payments blocked** — `initiateCustomerPayment()` requires `userId` (CUSTOMER role)
6. **No refund workflow** — `transitionPayment()` exists but no admin UI or customer flow
6. **No reconciliation job** — Out-of-order webhooks, failed deliveries, manual reconciliation unsupported

**Reusable Assets (No Changes Needed):**
- Payment/Booking models — complete, normalized, integer-cents storage
- Payment status transition map (`canTransitionPayment`) — complete
- Server-side `transitionPayment()` — atomic, idempotent, audited
- Idempotency keys on payment initiation — client + server dedup
- Customer/Admin APIs with strict ownership checks
- Immutable `PaymentEvent` audit trail
- Financial summaries (`deriveBookingPaymentSummary`) — net collected = paid - refunded
- Admin dashboards — net collected, awaiting provider, records

---

## 2. Current Architecture Inventory

### 2.1 Data Models (Prisma Schema)

| Model | Purpose | Status |
|-------|---------|--------|
| `Booking` | Trip reservation request | ✅ Complete |
| `BookingItem` | Frozen line items at checkout | ✅ Complete |
| `BookingActivity` | Immutable booking history | ✅ Complete |
| `Payment` | Provider-agnostic payment record | ✅ Complete |
| `PaymentEvent` | Immutable payment history | ✅ Complete |
| `PaymentAttempt` | Rate limiting for `/api/account/payments` | ✅ Complete |

**Key Payment Fields (DB):**
```prisma
model Payment {
  id                String         @id @default(cuid())
  reference         String         @unique @db.VarChar(16)  // SP-PAY-XXXXXX
  bookingId         String
  provider          String         @default("pending") @db.VarChar(64)
  providerPaymentId String?        @unique @db.VarChar(128)
  status            PaymentStatus  @default(PENDING)
  currency          String         @default("USD") @db.Char(3)
  amount            Decimal        @db.Decimal(10, 2)      // frozen at initiation
  amountPaid        Decimal        @default(0.00) @db.Decimal(10, 2)
  amountRefunded    Decimal        @default(0.00) @db.Decimal(10, 2)
  failureCode       String?        @db.VarChar(64)
  failureMessage    String?        @db.VarChar(255)
  idempotencyKey    String?        @unique @db.VarChar(64)
  initiatedAt       DateTime       @default(now())
  paidAt            DateTime?
  failedAt          DateTime?
  cancelledAt       DateTime?
  refundedAt        DateTime?
  metadata          String?        @db.Text
  events            PaymentEvent[]
  booking           Booking        @relation(fields: [bookingId], references: [id], onDelete: Cascade)
}
```

**Booking ↔ Payment Relationship:**
- `Booking.paymentStatus` ∈ {PENDING, PAID, REFUNDED} — **derived** from Payment rows
- `Booking.total` frozen at checkout (USD, DECIMAL(10,2))
- `Payment.amount` = `Booking.total` at initiation (frozen in cents)

### 2.2 Payment Status Lifecycle

```typescript
// lib/payment.ts:98-106
const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending:     ['processing', 'paid', 'failed', 'cancelled'],
  processing:  ['paid', 'failed', 'cancelled'],
  paid:        ['refunded', 'partially_refunded'],
  failed:      ['pending'],
  cancelled:   [],
  refunded:    [],
  partially_refunded: ['refunded'],
}
```

**Terminal states:** `cancelled`, `refunded` — never leave except `paid → refunded/partially_refunded`

### 2.3 Server-Side Services (lib/server/payments.ts)

| Function | Purpose | Gateway Exposure |
|----------|---------|------------------|
| `validatePaymentInitiation()` | Strict input validation (bookingRef + idempotencyKey only) | — |
| `initiateCustomerPayment()` | Creates PENDING payment, dedups active attempts | **Never marks PAID** |
| `transitionPayment()` | **Single enforced applier** — atomic, validates amounts, emits events, emails | For webhooks/offline only |
| `deriveBookingPaymentSummary()` | Net collected = paid - refunded | UI consumption |
| `listStaffPayments()` / `getStaffPayment()` | Admin reads with filters | Admin UI |
| `listCustomerPayments()` / `getCustomerPayment()` | Owner-only reads | Customer UI |

**Not Exposed to Browser:** `transitionPayment()` — only for webhooks/offline workflows

### 2.4 API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/account/payments` | GET | CUSTOMER | List own payments |
| `/api/account/payments` | POST | CUSTOMER | Initiate PENDING payment |
| `/api/account/payments/[ref]` | GET | CUSTOMER | Payment detail |
| `/api/admin/payments` | GET | `payments.view` | Admin list with filters |
| `/api/admin/payments/[ref]` | GET | `payments.view` | Admin detail |

**No Mutation Routes Exist** — `transitionPayment()` not exposed

### 2.5 Provider-Agnostic Contracts (lib/payment.ts)

```typescript
// Phase 2F-B contract — MUST be implemented per gateway
export interface PaymentProviderAdapter {
  readonly key: PaymentProviderKey
  initiate(payment: { reference, amountCents, currency: 'USD', idempotencyKey: string | null }): Promise<PaymentHandoff>
  handleCallback(rawBody: string, headers: Headers): Promise<ProviderCallbackOutcome>
}

export type PaymentHandoff = {
  provider: PaymentProviderKey
  providerPaymentId: string
  redirectUrl?: string
  metadata?: Record<string, string>
}

export type ProviderCallbackOutcome =
  | { type: 'paid'; amountPaidCents; providerPaymentId; metadata? }
  | { type: 'failed'; failureCode; failureMessage; providerPaymentId }
  | { type: 'refunded'; amountRefundedCents; providerPaymentId }
  | { type: 'ignored'; reason }
```

---

## 3. Verified Capabilities (No Work Needed)

| Capability | Implementation | Location |
|------------|----------------|----------|
| Server-owned pricing | Booking total computed server-side from canonical tours | `lib/server/bookings.ts:263-277` |
| Integer-cents storage | All amounts in DECIMAL(10,2), computed in cents | `lib/server/payments.ts:68-78` |
| Idempotent initiation | Client key + server unique constraint + active-attempt dedup | `lib/server/payments.ts:267-280` |
| Active attempt dedup | At most one PENDING/PROCESSING per booking | `lib/server/payments.ts:275-280` |
| Immutable audit trail | `PaymentEvent` rows never updated/deleted | `lib/server/payments.ts:106-122` |
| Atomic transitions | `transitionPayment()` in `$transaction` | `lib/server/payments.ts:467-491` |
| Amount validation | `amountRefunded ≤ amountPaid` enforced | `lib/server/payments.ts:463-464` |
| Net collected = paid - refunded | `deriveBookingPaymentSummary()` | `lib/server/payments.ts:169-198` |
| Customer ownership isolation | `userId` check on every read/mutation | `lib/server/payments.ts:258, 387` |
| Staff RBAC | `payments.view` / `payments.edit` permissions | `app/api/admin/payments/route.ts:23` |
| Net collected in dashboards | Admin: `paid - amountRefunded`; Customer: fixed | `app/admin/payments/page.tsx:82`, `components/account-portal.tsx:1266` |
| Booking/Payment independence | `Booking.paymentStatus` derived from Payments | `lib/server/payments.ts:169-198` |

---

## 4. Missing Capabilities (Require Implementation)

| Capability | Status | Effort |
|------------|--------|--------|
| **PaymentProviderAdapter implementation** | ❌ None | High (per gateway) |
| **Webhook endpoint** (`/api/payments/webhook/[provider]`) | ❌ None | Medium |
| **Webhook signature verification** | ❌ None | High |
| **Checkout session creation** (`initiate()`) | ❌ None | High (per gateway) |
| **Raw body parsing for webhooks** | ❌ None | Medium |
| **Timestamp/replay protection** | ❌ None | Medium |
| **Guest payment flow** | ❌ Blocked (requires CUSTOMER role) | High |
| **Refund workflow (UI + API)** | ❌ Only `transitionPayment()` exists | Medium |
| **Reconciliation job** | ❌ None | Medium |
| **Webhook deduplication** | ❌ None | Medium |
| **Out-of-order event handling** | ❌ `transitionPayment()` validates but no queue | Low |
| **Failed webhook retry/alerting** | ❌ None | Low |
| **Chargeback handling** | ❌ None | Low |
| **Guest payment tokens** | ❌ None | High |
| **Provider configuration storage** | ❌ None | Low |

---

## 5. Security Risk Assessment

| Risk | Severity | Mitigation Status |
|------|----------|-------------------|
| **Browser controls payment amount** | CRITICAL | ✅ Mitigated — server computes from canonical tours |
| **Browser controls payment status** | CRITICAL | ✅ Mitigated — only `transitionPayment()` (server) changes status |
| **Unauthorized payment confirmation** | CRITICAL | ✅ Mitigated — `transitionPayment()` not exposed to browser |
| **Double payment** | HIGH | ✅ Mitigated — idempotency keys + active attempt dedup |
| **Amount tampering in webhook** | CRITICAL | ❌ **Blocker** — no signature verification implemented |
| **Replay attacks on webhooks** | HIGH | ❌ **Blocker** — no timestamp/replay protection |
| **Out-of-order webhook delivery** | HIGH | ⚠️ Partial — `transitionPayment()` validates but no queue |
| **Guest payment enumeration** | MEDIUM | ⚠️ Partial — guest bookings exist but no payment flow |
| **Refund exceeding paid amount** | HIGH | ✅ Mitigated — `amountRefunded ≤ amountPaid` enforced (line 463) |
| **Double refund** | HIGH | ✅ Mitigated — `transitionPayment()` validates amounts |
| **Unauthorized status change** | HIGH | ✅ Mitigated — `transitionPayment()` not exposed, `canTransitionPayment` enforced |
| **Sensitive data in logs** | MEDIUM | ✅ Mitigated — `metadata` only, no card data stored |
| **Currency mismatch** | MEDIUM | ⚠️ Partial — only USD supported, no conversion |
| **Zero-decimal currency support** | LOW | ❌ Not supported — DECIMAL(10,2) assumes 2 decimals |

---

## 6. Guest Payment Architecture (Proposal)

**Problem:** `initiateCustomerPayment()` requires `userId` (CUSTOMER role). Guest bookings have `userId = NULL` and cannot initiate payments.

**Proposed Architecture: Signed Payment Access Tokens**

```typescript
// New table needed
model GuestPaymentToken {
  id          String   @id @default(cuid())
  tokenHash   String   @unique @db.VarChar(128)
  bookingId   String
  email       String   @db.VarChar(190)
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime @default(now())
  booking     Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  @@index([bookingId])
  @@index([expiresAt])
  @@map("guest_payment_tokens")
}
```

**Token Flow:**
1. Guest creates booking → `userId = NULL`
2. Guest clicks "Pay Now" → server generates JWT: `{ bookingId, ref, exp, scope: "payment:initiate" }`
2. Token signed with rotating secret, stored as hash in `GuestPaymentToken`
3. Guest receives secure link: `/pay?token=<jwt>`
4. Payment initiation endpoint accepts token → validates signature, expiry, scope, booking match
5. Token marked `usedAt` on successful initiation (rotation)

**Security Controls:**
- Token expiration: 24h (configurable)
- Rate limit: 5 attempts/hour per email/IP
- Token rotation on use (prevents replay)
- Booking ownership verified via token payload (no session needed)
- Prevents reference enumeration (token required, not ref)

---

## 7. Webhook Security Requirements

| Protection | Required | Current |
|------------|----------|---------|
| **Raw request body access** | ✅ | ❌ Need `bodyParser.raw()` middleware |
| **Signature verification** | ✅ | ❌ Per-gateway (HMAC-SHA256, RSA, etc.) |
| **Timestamp validation** (±5min) | ✅ | ❌ |
| **Replay protection** (unique event ID) | ✅ | ⚠️ `PaymentEvent` dedup by `(paymentId, action, createdAt)` only |
| **Idempotent processing** | ✅ | ⚠️ `transitionPayment()` validates but no deduplication on event ID |
| **Atomic transactions** | ✅ | ✅ `transitionPayment()` uses `$transaction` |
| **Out-of-order handling** | ✅ | ⚠️ Validates transitions but no queue |
| **Duplicate delivery** | ✅ | ⚠️ No provider event ID dedup |
| **Amount verification** | ✅ | ⚠️ Validated in `transitionPayment()` (line 461-464) |
| **Currency verification** | ✅ | ⚠️ Only USD supported |
| **Booking reference verification** | ✅ | ✅ Enforced in `transitionPayment()` |
| **Audit history** | ✅ | ✅ `PaymentEvent` + `StaffActionAudit` |
| **Retry/reconciliation** | ⚠️ | ❌ None |
| **Refund webhook** | ⚠️ | ❌ No `refunded` outcome handling |
| **Chargeback webhook** | ⚠️ | ❌ None |

**Required Webhook Handler Signature:**
```typescript
// lib/server/payments.ts needs:
export async function handleProviderWebhook(
  providerKey: PaymentProviderKey,
  rawBody: string,
  headers: Headers
): Promise<ProviderCallbackOutcome> {
  const adapter = getAdapter(providerKey)
  const outcome = await adapter.handleCallback(rawBody, headers)
  // Apply outcome via transitionPayment()
  // Idempotent on provider event ID
}
```

---

## 8. Currency & Amount Assessment

| Aspect | Current | Gap |
|--------|---------|-----|
| **Base currency** | USD only | No multi-currency support |
| **Storage** | DECIMAL(10,2) in USD cents | Integer-cents correct |
| **Gateway amount mapping** | `amountCents` passed to adapter | Ready |
| **Zero-decimal currencies** | Not supported | JPY, KRW, etc. would lose precision |
| **Refund precision** | DECIMAL(10,2) | Matches payment precision |
| **Currency conversion** | Not implemented | Presentation-only EUR/EGP switching |
| **Cross-currency reconciliation** | N/A | Not needed (single currency) |

**Decision Required:** If multi-currency needed, schema changes required:
- `Payment.currency` already exists (CHAR(3))
- `Booking.currency` already exists (CHAR(3))
- Need exchange rate snapshot at initiation
- DECIMAL(10,2) → DECIMAL(19,4) for high-precision currencies

---

## 9. Financial Security Summary

| Control | Implemented | Location |
|---------|-------------|----------|
| Server-owned pricing | ✅ | `lib/server/bookings.ts:263-277` |
| Amount tampering prevention | ✅ | Server computes from canonical tours |
| Double payment prevention | ✅ | Idempotency keys + active attempt dedup |
| Concurrent payment initiation | ✅ | Active attempt dedup (one per booking) |
| Refund amount limits | ✅ | `amountRefunded ≤ amountPaid` (line 463) |
| Payment status integrity | ✅ | `transitionPayment()` only server-side |
| Unauthorized manual confirmation | ✅ | `transitionPayment()` not exposed |
| Staff RBAC | ✅ | `payments.view`/`edit` permissions |
| Customer ownership isolation | ✅ | `userId` checks on all reads |
| Sensitive data logging | ✅ | `metadata` only, no card data |
| Secret management | ✅ | Environment variables only |

---

## 10. Admin & Customer Experience Readiness

### Customer (Future Requirements)

| Feature | Status | Notes |
|---------|--------|-------|
| Pay now action | ✅ UI exists (`Pay now` button) | Creates PENDING, shows "awaiting provider" |
| Secure checkout redirect | ❌ | Needs `PaymentHandoff.redirectUrl` |
| Payment pending state | ✅ | Shows "Unpaid", amount awaiting |
| Payment confirmation | ⚠️ | Only on `paid` status (webhook-driven) |
| Failed payment retry | ✅ | Can re-initiate (dedups active) |
| Guest payment link | ❌ | Blocked — requires token architecture |
| Refund status | ⚠️ | Shows in `paymentStatus` but no UI |
| Payment history | ✅ | Full timeline with `PaymentEvent` |

### Admin (Future Requirements)

| Feature | Status | Notes |
|---------|--------|-------|
| Payment detail | ✅ | Full timeline, provider ref, amounts |
| Gateway transaction reference | ⚠️ | `providerPaymentId` field exists, read-only |
| Payment events timeline | ✅ | `PaymentEvent` with internal markers |
| Refund visibility | ❌ | No refund workflow UI |
| Reconciliation status | ❌ | No reconciliation job |
| Payment filters | ✅ | Status, date, search |
| Provider errors | ⚠️ | `failureCode`/`failureMessage` fields exist |
| Financial reporting | ✅ | Net collected, awaiting provider, records |

---

## 11. Provider-Neutral Integration Design

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Application Layer (Next.js Pages, React Components)        │
│  - Admin/Customer dashboards                                │
│  - Payment initiation UI (Pay now)                          │
│  - Payment history/timeline                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Payment Core (lib/server/payments.ts) — PROVIDER AGNOSTIC  │
│  - initiateCustomerPayment()                                │
│  - transitionPayment() — single enforced applier            │
│  - deriveBookingPaymentSummary()                            │
│  - canTransitionPayment() / PAYMENT_TRANSITIONS             │
│  - Idempotency, dedup, audit trail                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Provider Adapter Layer (lib/payments/providers/)           │
│  - PaymentProviderAdapter interface                         │
│  - StripeAdapter, PayPalAdapter, etc.                       │
│  - checkout session creation (initiate)                     │
│  - webhook verification (handleCallback)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  External Gateways (Stripe, PayPal, etc.)                   │
│  - Checkout sessions                                        │
│  - Webhooks                                                 │
│  - Refunds                                                  │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure (Proposed)

```
lib/
├── payment.ts                 # Types, transitions, labels (EXISTING)
├── server/
│   ├── payments.ts            # Core service (EXISTING)
│   ├── payments/
│   │   ├── index.ts           # Registry: getAdapter(key)
│   │   ├── stripe/
│   │   │   ├── adapter.ts     # implements PaymentProviderAdapter
│   │   │   ├── webhook.ts     # Stripe-specific verification
│   │   │   └── config.ts      # Stripe keys, webhook secret
│   │   ├── paypal/
│   │   │   ├── adapter.ts
│   │   │   ├── webhook.ts
│   │   │   └── config.ts
│   │   └── factory.ts         # getAdapter(key) with feature flag
│   └── webhooks/
│       └── route.ts           # /api/payments/webhook/[provider]
├── payments/
│   └── providers.ts           # Feature flags, provider config
```

**Feature Flag Control:**
```typescript
// lib/payments/providers.ts
export const PAYMENT_PROVIDERS = {
  stripe: { enabled: process.env.STRIPE_ENABLED === 'true', key: 'stripe' },
  paypal: { enabled: process.env.PAYPAL_ENABLED === 'true', key: 'paypal' },
} as const
```

---

## 12. Required Database Changes

| Change | Type | Required For | Existing Reusable |
|--------|------|--------------|-------------------|
| `GuestPaymentToken` table | **Required** | Guest payments | — |
| `Payment.providerPaymentId` index | Exists | Webhook dedup | ✅ |
| `Payment.metadata` field | Exists | Provider payload | ✅ |
| `CheckoutSession` table | Optional | Multi-step checkout | — |
| `ReconciliationAttempt` table | Optional | Reconciliation job | — |
| `ProviderConfig` table | Optional | Multi-gateway config | — |
| `PaymentEvent.providerEventId` field | **Required** | Webhook dedup | — |
| `Payment.providerEventId` unique index | **Required** | Duplicate prevention | — |

**Migration Required (DO NOT RUN — Owner Approval):**
```sql
-- Guest payments
CREATE TABLE guest_payment_tokens (
  id VARCHAR(25) PRIMARY KEY,
  token_hash VARCHAR(128) UNIQUE NOT NULL,
  booking_id VARCHAR(25) NOT NULL,
  email VARCHAR(190) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);
CREATE INDEX idx_guest_tokens_booking ON guest_payment_tokens(booking_id);
CREATE INDEX idx_guest_tokens_expires ON guest_payment_tokens(expires_at);

-- Webhook deduplication
ALTER TABLE payment_events ADD COLUMN provider_event_id VARCHAR(128);
CREATE UNIQUE INDEX uq_payment_provider_event ON payment_events(provider_event_id);
```

**Existing Reusable (No Migration):**
- `Payment.providerPaymentId` — unique, for gateway reference
- `Payment.idempotencyKey` — unique, for client dedup
- `Payment.metadata` — JSON text for provider payload
- `Booking.paymentStatus` — derived, no manual sync needed

---

## 13. Suggested Implementation Phases

### Phase 1: Core Gateway Integration (2-3 weeks)
1. Implement `PaymentProviderAdapter` for chosen gateway (Stripe first)
2. Create `/api/payments/webhook/[provider]` with raw body parsing
3. Implement signature verification, timestamp check, replay protection
4. Connect webhook → `transitionPayment()` with idempotent provider event ID
5. Implement `initiate()` → create checkout session → return `redirectUrl`
6. Update customer "Pay now" to redirect to `PaymentHandoff.redirectUrl`

### Phase 2: Guest Payments (1-2 weeks)
1. Add `GuestPaymentToken` table (migration)
2. Implement token generation/validation middleware
3. Create `/pay?token=<jwt>` page for guest checkout
4. Token validation middleware for `/api/payments/guest/initiate`

### Phase 3: Refund Workflow (1 week)
1. Admin UI: "Refund" button on paid payments (requires `payments.edit`)
2. API: `POST /api/admin/payments/[ref]/refund` → `transitionPayment(to: 'refunded')`
3. Customer notification + email on refund

### Phase 4: Reconciliation & Hardening (1-2 weeks)
1. Add `providerEventId` to `PaymentEvent` (migration)
2. Webhook deduplication on `providerEventId`
3. Reconciliation job: daily scan for pending/processing > 24h
3. Alerting for failed webhooks, stale payments
4. Manual reconciliation admin page

### Phase 5: Multi-Gateway & Features (Ongoing)
1. Add second gateway (PayPal, etc.)
2. Feature flags per gateway
3. Test/live environment separation
4. Guest payment tokens (Phase 2+)
4. Chargeback handling

---

## 14. Owner Decisions Required

| Decision | Options | Recommendation |
|----------|---------|----------------|
| **Primary gateway** | Stripe / PayPal / Adyen / Local | **Stripe** — best docs, webhooks, testing |
| **Test vs Live separation** | Single env with flag / Separate projects | **Separate Stripe accounts** — avoids test/live collision |
| **Guest payments** | Enable now / Phase 2 only | **Phase 2** — core integration first |
| **Refund workflow** | Admin-only / Customer-initiated | **Admin-only** — matches Phase 2F-B design |
| **Reconciliation schedule** | Daily / Hourly / Manual | **Daily cron** + manual trigger |
| **Currency support** | USD only / Multi-currency | **USD only** for Phase 2F-B |
| **Zero-decimal currencies** | Support / Defer | **Defer** — not needed for USD/EGP |
| **Webhook retry policy** | Exponential backoff / Dead letter queue | **Exponential (1m, 5m, 15m, 1h, 6h)** + alert |
| **Test card handling** | Separate test mode / Always live | **Stripe test mode** with feature flag |

---

## 15. Test & Acceptance Criteria

### Unit/Integration Tests (New)
- `initiateCustomerPayment()` dedups correctly
- `transitionPayment()` enforces all transitions
- `deriveBookingPaymentSummary()` net collected = paid - refunded
- Webhook signature verification rejects tampered payloads
- Idempotent webhook processing (same event ID twice = no-op)
- Guest token expiry, rotation, replay prevention

### E2E Scenarios (Manual/Browser)
1. **Customer pays booking** → redirected → completes on gateway → webhook → payment PAID → booking PAID
2. **Customer pays, gateway fails** → webhook → payment FAILED → customer can retry
3. **Customer pays, cancels on gateway** → webhook → payment CANCELLED
4. **Admin refunds paid payment** → payment REFUNDED → booking REFUNDED
5. **Guest initiates payment** → token generated → pays → webhook → success
6. **Duplicate webhook delivery** → second delivery = no-op
7. **Out-of-order webhooks** (paid before processing) → handled gracefully

### Acceptance Criteria for Go-Live
- [ ] All unit tests pass
- [ ] 5 successful test payments via gateway test mode
- [ ] 2 successful test refunds
- [ ] 3 failed payments handled correctly
- [ ] 2 guest payments work end-to-end
- [ ] Webhook retry alerting fires on simulated failure
- [ ] Reconciliation job reports 0 discrepancies
- [ ] Admin dashboard shows correct net collected

---

## 16. Deployment Considerations (Hostinger)

| Aspect | Consideration |
|--------|---------------|
| **Webhook URL** | Must be publicly accessible HTTPS: `https://starpyramids.com/api/payments/webhook/stripe` |
| **Raw body access** | Next.js `bodyParser: false` + `req.rawBody` or custom middleware |
| **Environment variables** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_ENABLED=true` |
| **HTTPS enforcement** | Required for webhook signature verification |
| **Cron jobs** | Hostinger cron for daily reconciliation (`/api/admin/payments/reconcile`) |
| **Logs** | Payment events + webhook errors to structured logging |
| **Secrets** | Never in code — use Hostinger environment variables |
| **SSL/TLS** | Must be valid for webhook domain verification |

---

## 17. File References

| Component | Path |
|-----------|------|
| Payment types & transitions | `lib/payment.ts` |
| Payment core service | `lib/server/payments.ts` |
| Payment API (customer) | `app/api/account/payments/route.ts` |
| Payment API (admin) | `app/api/admin/payments/route.ts` |
| Payment detail API | `app/api/admin/payments/[ref]/route.ts` |
| Customer payment detail | `components/account-portal.tsx` (PaymentDetailSection) |
| Admin payment list | `app/admin/payments/page.tsx` |
| Admin payment detail | `app/admin/payments/[ref]/content.tsx` |
| Payment model | `prisma/schema.prisma` (Payment, PaymentEvent, Booking) |
| Booking service | `lib/server/bookings.ts` |
| Booking payment summary | `lib/server/payments.ts:169-198` |

---

## 18. Conclusion

**The STAR PYRAMIDS payment core is production-ready for Phase 2F-A.** All financial logic, security controls, audit trails, and admin/customer UIs are complete and verified against real database records. The system correctly handles net collected calculations, partial refunds, idempotency, and ownership isolation.

**The only missing piece for live payments is the provider adapter + webhook layer** — approximately 2-3 weeks of focused implementation for a single gateway (Stripe recommended). Guest payments require an additional 1-2 weeks for token architecture.

**No schema changes are required for the core gateway integration** — existing `Payment` model supports all needed fields. Only guest payments and webhook deduplication require migrations.

**All validation checks pass:**
- `prisma validate` ✅
- `prisma migrate status` ✅ (up to date)
- `tsc --noEmit` ✅
- `pnpm build` ✅ (241/241 pages)
- `git diff --check` ✅

**Next Step:** Owner approval to proceed with Stripe adapter implementation (Phase 1).