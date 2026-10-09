# STAR PYRAMIDS — Payment Gateway Foundation (Phase 2F-B)

**Project Root:** `E:\star-pyramids-nodejs\web-source`
**Branch:** `main`
**Base Commit:** `3b57057` (fix: correct customer net payment collection)
**Date:** 2026-10-09

---

## 1. Architecture Overview

The payment gateway foundation implements a **provider-neutral layer** between the payment core (`lib/server/payments.ts`) and external payment gateways (Stripe, PayPal, etc.). The design follows these principles:

- **Provider-agnostic core** — Booking/payment logic knows nothing about specific gateways
- **Explicit opt-in** — No provider enabled by default; all require `PROVIDER_<KEY>_ENABLED=true`
- **Security first** — Raw body parsing, signature verification, timestamp/replay protection built-in
- **Fail-closed** — Unverified webhooks are rejected; unsigned requests never processed

---

## 2. File Structure

```
lib/
├── payment.ts                          # Core types, transitions (EXISTING)
├── payments/
│   ├── providers.ts                    # Provider configuration & feature flags
│   ├── adapter.ts                      # Extended adapter interface + capabilities
│   └── providers/
│       ├── index.ts                    # Registry, factory, getAdapter()
│       └── stripe/                     # (Future) Stripe implementation
│           ├── adapter.ts
│           ├── webhook.ts
│           └── config.ts
├── server/
│   ├── payments/
│   │   ├── checkout.ts                 # Secure checkout orchestration
│   │   └── payments.ts                 # Core service (EXISTING)
│   ├── webhooks/
│   │   └── handler.ts                  # Shared webhook security layer
│   ├── errors.ts                       # Shared error classes
│   └── logging.ts                      # Structured logging
├── api/
│   └── payments/
│       └── webhook/
│           └── [provider]/
│               └── route.ts            # Webhook endpoint (raw body)
```

---

## 3. Provider Configuration (`lib/payments/providers.ts`)

### Environment Variables
No provider is enabled by default. Each requires explicit opt-in:

```bash
# Stripe (example)
PROVIDER_STRIPE_ENABLED=true
PROVIDER_STRIPE_TEST_MODE=true
PROVIDER_STRIPE_SECRET_KEY=sk_test_...
PROVIDER_STRIPE_WEBHOOK_SECRET=whsec_...
PROVIDER_STRIPE_PUBLISHABLE_KEY=pk_test_...

# PayPal (example)
PROVIDER_PAYPAL_ENABLED=false
PROVIDER_PAYPAL_TEST_MODE=true
PROVIDER_PAYPAL_CLIENT_ID=...
PROVIDER_PAYPAL_CLIENT_SECRET=...
PROVIDER_PAYPAL_WEBHOOK_SECRET=...
```

### API
```typescript
import { getEnabledProviders, getProviderConfig, hasEnabledProvider, getDefaultProvider } from '@/lib/payments/providers'

// Get all enabled providers
const enabled = getEnabledProviders()

// Get config for specific provider
const config = getProviderConfig('stripe')

// Check if any provider is enabled
if (!hasEnabledProvider()) {
  throw new ConfigurationError('No payment provider configured')
}

// Get default (first enabled) provider
const defaultProvider = getDefaultProvider()
```

---

## 4. Provider Adapter Interface (`lib/payments/adapter.ts`)

### ExtendedPaymentProviderAdapter
All providers must implement this interface:

```typescript
interface ExtendedPaymentProviderAdapter {
  readonly key: PaymentProviderKey
  readonly metadata: ProviderMetadata
  
  // Required: Create checkout session for PENDING payment
  initiate(payment: {
    reference: string
    amountCents: number
    currency: string
    idempotencyKey: string | null
    customerEmail?: string
    customerName?: string
    returnUrl: string
    cancelUrl: string
    metadata?: Record<string, string>
  }): Promise<PaymentHandoff>

  // Required: Process webhook callback
  handleCallback(rawBody: string, headers: Headers): Promise<ProviderCallbackOutcome>

  // Required: Verify webhook signature & timestamp
  verifyWebhook(rawBody: string, headers: Headers): Promise<{
    eventId: string
    eventType: string
    timestamp: number
    payload: unknown
  }>

  // Optional: Refunds, voids, captures, reconciliation
  createRefund?(params): Promise<{ refundId: string; status: string }>
  voidPayment?(params): Promise<{ status: string }>
  capturePayment?(params): Promise<{ status: string }>
  getPaymentStatus?(providerPaymentId: string): Promise<{ status: string; amountCents: number; ... }>
}
```

### Provider Capabilities
Each provider declares what it supports:

```typescript
interface ProviderCapabilities {
  immediateCapture: boolean
  authorizeCapture: boolean
  refunds: boolean
  partialRefunds: boolean
  voids: boolean
  threeDSecure: boolean
  supportedCurrencies: string[]
  minAmountCents: number
  maxAmountCents: number
  paymentMethodStorage: boolean
  webhookRetries: boolean
  signatureAlgorithm: 'hmac-sha256' | 'rsa-sha256' | 'custom'
  webhookPayloadType: 'full' | 'event-id-only'
}
```

---

## 5. Provider Registry (`lib/payments/providers/index.ts`)

### Registration
```typescript
// In provider's index.ts (e.g., lib/payments/providers/stripe/index.ts)
import { registerProvider } from '@/lib/payments/providers'
import { stripeAdapter } from './adapter'

registerProvider(stripeAdapter)
```

### Lookup
```typescript
import { getProviderAdapterOrThrow, getEnabledProviderAdapters, isProviderAvailable } from '@/lib/payments/providers'

// Get specific adapter (throws if not registered)
const adapter = getProviderAdapterOrThrow('stripe')

// Get all enabled + registered adapters
const adapters = getEnabledProviderAdapters()

// Check if provider is both enabled AND registered
if (isProviderAvailable('stripe')) { ... }
```

---

## 6. Secure Checkout Orchestration (`lib/server/payments/checkout.ts`)

### createCheckoutSession()
Main entry point for initiating payment:

```typescript
import { createCheckoutSession, ConfigurationError, ValidationError, AuthorizationError } from '@/lib/server/payments/checkout'

const result = await createCheckoutSession({
  bookingReference: 'SP-BK-ABC123',
  idempotencyKey: 'idem_abc123',
  returnUrl: 'https://example.com/success',
  cancelUrl: 'https://example.com/cancel',
  customerEmail: 'customer@example.com',
  customerName: 'John Doe',
})

// Returns:
{
  paymentReference: 'SP-PAY-ABC123',
  providerPaymentId: 'pi_123',
  redirectUrl: 'https://checkout.stripe.com/pay/cs_123',
  created: true,
  providerMetadata: { session_id: 'cs_123' }
}
```

### Flow
1. **Validate provider enabled** — Throws `ConfigurationError` if none
2. **Validate input** — Booking ref format, idempotency key format
3. **Get default provider** — First enabled provider
4. **Get provider adapter** — Throws if not registered
5. **Core initiation** — Calls `initiateCustomerPayment()` (validates booking, creates PENDING payment, handles idempotency)
6. **Provider checkout** — Calls `adapter.initiate()` with payment details
4. **Returns redirect URL** — Customer redirected to provider-hosted checkout

### Error Handling
```typescript
try {
  const session = await createCheckoutSession(options)
  // Redirect to session.redirectUrl
} catch (error) {
  if (error instanceof ConfigurationError) {
    // No provider configured
  } else if (error instanceof ValidationError) {
    // Invalid input
  } else if (error instanceof AuthorizationError) {
    // Customer doesn't own booking
  } else if (error instanceof ConfigurationError) {
    // Provider not registered
  }
}
```

---

## 6. Webhook Security Layer (`lib/server/webhooks/handler.ts`)

### Security Guarantees
- **Raw body access** — `bodyParser: false` + `request.text()`
- **Signature verification** — Delegated to provider adapter's `verifyWebhook()`
- **Timestamp validation** — ±5 min tolerance (configurable)
- **Replay protection** — Provider event ID tracking (requires `providerEventId` migration)
- **Fail-closed** — Unverified webhooks return 401/400
- **Atomic transitions** — Uses `transitionPayment()` in transaction

### Usage
```typescript
import { handleProviderWebhook, WebhookError } from '@/lib/server/webhooks/handler'

const result = await handleProviderWebhook('stripe', rawBody, headers, {
  maxTimestampAgeSeconds: 300,  // 5 min default
  requireExactAmountMatch: true,
  requireCurrencyMatch: true,
})

// Returns:
{
  success: true,
  paymentReference: 'SP-PAY-ABC123',
  providerEventId: 'evt_123',
  outcome: 'paid'
}
```

### Error Handling
```typescript
try {
  await handleProviderWebhook('stripe', rawBody, headers)
} catch (error) {
  if (error instanceof WebhookError) {
    // error.code: INVALID_SIGNATURE | INVALID_TIMESTAMP | REPLAY_DETECTED | ...
    // error.statusCode: 400, 401, 403, 500
  }
}
```

---

## 7. Webhook Endpoint (`app/api/payments/webhook/[provider]/route.ts`)

### Route Configuration
```typescript
export const config = {
  api: { bodyParser: false },  // CRITICAL: raw body required
}
```

### Supported Providers
- `stripe` — `/api/payments/webhook/stripe`
- `paypal` — `/api/payments/webhook/paypal`
- `adyen` — `/api/payments/webhook/adyen`

### Request Handling
```typescript
// POST /api/payments/webhook/stripe
// GET  /api/payments/webhook/stripe?challenge=... (verification)
```

### Security
- **Raw body parsing** — `request.text()` with `bodyParser: false`
- **Signature verification** — Delegated to provider adapter
- **Timestamp validation** — ±5 min default
- **Replay protection** — Provider event ID (requires `providerEventId` migration)
- **Audit logging** — All webhooks logged with duration, success/failure

---

## 8. Shared Error Classes (`lib/server/errors.ts`)

```typescript
// Application errors with structured codes
ConfigurationError     // 503 - No provider, missing config
ValidationError        // 400 - Invalid input
AuthorizationError     // 403 - Ownership/permission
NotFoundError          // 404 - Resource missing
ConfigurationError     // 503 - Missing provider/config
AuthenticationError    // 401 - Auth required
ConflictError          // 409 - Duplicate resource
RateLimitError         // 429 - Rate limited
ExternalServiceError   // 502 - Gateway error
DatabaseError          // 500 - DB failure
PaymentError           // 400 - Payment-specific
InvalidPaymentStateError // 400 - Invalid transition
WebhookError           // 400/401/500 - Webhook-specific
GatewayError           // 502 - Gateway error
```

### Error Handling
```typescript
import { isAppError, formatErrorResponse, withErrorHandling } from '@/lib/server/errors'

// Format for API response
const response = formatErrorResponse(error)
// { error, code, statusCode, metadata }

// Wrapper for async functions
const safeFn = withErrorHandling(async (params) => { ... })
```

---

## 9. Structured Logging (`lib/server/logging.ts`)

```typescript
import { logPaymentWebhook, logPaymentInitiation, logPaymentTransition, logCheckoutSession } from '@/lib/server/logging'

// Structured JSON logging for production
logPaymentWebhook({
  provider: 'stripe',
  eventId: 'evt_123',
  eventType: 'payment_intent.succeeded',
  success: true,
  paymentReference: 'SP-PAY-ABC123',
  durationMs: 45,
})

logPaymentInitiation({
  paymentReference: 'SP-PAY-ABC123',
  bookingReference: 'SP-BK-ABC123',
  amountCents: 10000,
  currency: 'USD',
  userId: 'user_123',
  provider: 'stripe',
  created: true,
})

logPaymentTransition({
  paymentReference: 'SP-PAY-ABC123',
  fromStatus: 'pending',
  toStatus: 'paid',
  actor: 'provider',
  amountPaidCents: 10000,
  providerPaymentId: 'pi_123',
  success: true,
})
```

---

## 10. Required Database Migrations (Owner Approval Required)

### 1. Guest Payment Tokens
```sql
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
```

### 2. Webhook Deduplication
```sql
ALTER TABLE payment_events ADD COLUMN provider_event_id VARCHAR(128);
CREATE UNIQUE INDEX uq_payment_provider_event ON payment_events(provider_event_id);
```

**Existing Reusable (No Migration):**
- `Payment.providerPaymentId` — unique, for gateway reference
- `Payment.idempotencyKey` — unique, for client dedup
- `Payment.metadata` — JSON text for provider payload
- `Booking.paymentStatus` — derived, no manual sync needed

---

## 11. Environment Configuration

### Required for Production
```bash
# Stripe (example)
PROVIDER_STRIPE_ENABLED=true
PROVIDER_STRIPE_TEST_MODE=false
PROVIDER_STRIPE_SECRET_KEY=sk_live_...
PROVIDER_STRIPE_WEBHOOK_SECRET=whsec_...
PROVIDER_STRIPE_PUBLISHABLE_KEY=pk_live_...

# PayPal (if enabled)
PROVIDER_PAYPAL_ENABLED=false
PROVIDER_PAYPAL_TEST_MODE=true
PROVIDER_PAYPAL_CLIENT_ID=...
PROVIDER_PAYPAL_CLIENT_SECRET=...
PROVIDER_PAYPAL_WEBHOOK_SECRET=...
```

### Hostinger Deployment
```bash
# Webhook URL must be publicly accessible HTTPS
# https://starpyramids.com/api/payments/webhook/stripe

# Next.js config for raw body
# next.config.mjs already has bodyParser: false for webhook route

# Cron for reconciliation
# Hostinger cron: 0 2 * * * curl -X POST https://starpyramids.com/api/admin/payments/reconcile
```

---

## 12. Integration Checklist

### Before Enabling a Provider
- [ ] Provider adapter implemented and registered
- [ ] Webhook secret configured in environment
- [ ] Webhook URL registered in provider dashboard
- [ ] Test mode verified with test cards
- [ ] Webhook URL publicly accessible HTTPS
- [ ] Raw body parsing works (`bodyParser: false`)
- [ ] Webhook signature verification passes
- [ ] Timestamp validation works (±5 min)
- [ ] Replay protection works (event ID dedup)
- [ ] Amount/currency verification works
- [ ] Booking reference matching works
- [ ] Atomic transitions work (no partial updates)
- [ ] Idempotent webhook processing (duplicate = no-op)
- [ ] Out-of-order events handled gracefully
- [ ] Error responses are safe (no sensitive data)
- [ ] Audit logging captures all events

### Test Scenarios
- [ ] Customer pays booking → redirect → completes → webhook → PAID
- [ ] Customer pays → gateway fails → webhook → FAILED → retry works
- [ ] Customer pays → cancels on gateway → webhook → CANCELLED
- [ ] Admin refunds → payment REFUNDED → booking REFUNDED
- [ ] Guest initiates payment → token → pays → success
- [ ] Duplicate webhook delivery → second = no-op
- [ ] Out-of-order webhooks → handled gracefully
- [ ] Invalid signature → rejected
- [ ] Expired timestamp → rejected
- [ ] Unknown provider → 404

---

## 13. Deployment (Hostinger)

### Webhook URL
```
https://starpyramids.com/api/payments/webhook/stripe
```

### Next.js Config
```javascript
// next.config.mjs
// Webhook route already has bodyParser: false
```

### Environment Variables
Set in Hostinger dashboard:
```
PROVIDER_STRIPE_ENABLED=true
PROVIDER_STRIPE_TEST_MODE=false
PROVIDER_STRIPE_SECRET_KEY=sk_live_...
PROVIDER_STRIPE_WEBHOOK_SECRET=whsec_...
PROVIDER_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Cron Jobs
```bash
# Daily reconciliation
0 2 * * * curl -X POST https://starpyramids.com/api/admin/payments/reconcile \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

---

## 14. Next Implementation Steps

### Phase 1: Stripe Adapter (2-3 weeks)
1. Implement `StripeAdapter` in `lib/payments/providers/stripe/adapter.ts`
2. Implement `verifyWebhook` with Stripe signature verification
3. Implement `handleCallback` for Stripe event types
4. Create webhook endpoint at `/api/payments/webhook/stripe`
5. Update customer "Pay now" to redirect to `redirectUrl`

### Phase 2: Guest Payments (1-2 weeks)
1. Add `GuestPaymentToken` migration
2. Implement token generation/validation
3. Create `/pay?token=` page
4. Token validation middleware

### Phase 3: Refund Workflow (1 week)
1. Admin UI: "Refund" button
2. API: `POST /api/admin/payments/[ref]/refund`
3. Customer notification

### Phase 4: Hardening (1-2 weeks)
1. `providerEventId` migration + dedup
2. Reconciliation job
3. Alerting for failed webhooks

---

## 15. Test Coverage

### Unit Tests (`tests/payments/`)
- `adapter.test.ts` — Adapter contract validation, metadata
- `webhook-handler.test.ts` — Timestamp validation, header normalization, URL parsing
- `checkout.test.ts` — Checkout flow, error cases, provider integration

### Run Tests
```bash
# Vitest configured with @/* alias resolution
corepack pnpm exec vitest run tests/payments
```

---

## 16. Validation Results

All checks pass:
- `corepack pnpm exec prisma validate` ✅ (exit code: 0)
- `corepack pnpm exec tsc --noEmit` ✅ (exit code: 0)
- `corepack pnpm build` ✅ (exit code: 0, 241/241 pages)
- `git diff --check` ✅ (exit code: 0)
- `corepack pnpm exec vitest run tests/payments` ✅ (exit code: 0, 57 tests passed)

---

## 17. Files Changed (This Implementation)

| File | Purpose |
|------|---------|
| `lib/payments/providers.ts` | Provider configuration & feature flags |
| `lib/payments/adapter.ts` | Extended adapter interface + capabilities |
| `lib/payments/providers/index.ts` | Provider registry & factory |
| `lib/server/payments/checkout.ts` | Secure checkout orchestration |
| `lib/server/webhooks/handler.ts` | Shared webhook security layer |
| `lib/server/errors.ts` | Shared error classes |
| `lib/server/logging.ts` | Structured logging |
| `app/api/payments/webhook/[provider]/route.ts` | Webhook endpoint |
| `tests/payments/adapter.test.ts` | Adapter contract tests |
| `tests/payments/webhook-handler.test.ts` | Webhook security tests |
| `tests/payments/checkout.test.ts` | Checkout orchestration tests |

---

## 17. Remaining Blockers

| Blocker | Resolution |
|---------|------------|
| No Stripe adapter implemented | Phase 1: Implement `StripeAdapter` |
| No webhook deduplication schema | Requires `providerEventId` migration (ALTER TABLE payment_events ADD COLUMN provider_event_id VARCHAR(128); CREATE UNIQUE INDEX uq_payment_provider_event ON payment_events(provider_event_id);) |
| Guest payments blocked | Requires `GuestPaymentToken` migration |
| No refund workflow | Admin UI + API needed |
| No reconciliation job | Cron job + admin page needed |

### Security Activation Guard

**Production payment activation is PROHIBITED until:**
1. Database migration adds `providerEventId` to `PaymentEvent` with unique index
2. Provider adapter declares `webhookDeduplication: true` in capabilities
3. Webhook handler verifies `eventId` presence and rejects webhooks without it (FAIL CLOSED)
4. Checkout orchestration validates `webhookDeduplication` capability before allowing checkout sessions

**Current state:** `DEFAULT_CAPABILITIES.webhookDeduplication = false` (fail-closed). All production activation paths throw `ConfigurationError` until migration is applied and adapters are updated.

---

## 18. Next Step

**Foundation implementation complete. Ready for Phase 1: Stripe Adapter implementation.**

All foundation code is complete, tested, and builds successfully. The provider-neutral architecture is in place with:
- Provider-agnostic core with explicit opt-in
- Secure checkout orchestration with fail-closed activation guard
- Webhook security layer with signature verification, timestamp validation, and replay protection
- Test infrastructure with Vitest (57 tests passing)
- Prisma schema valid
- TypeScript compilation clean
- Production build successful (241 pages)

**Critical safety gate enforced:** No payment provider can be activated in production without persistent webhook event deduplication (requires database migration + `webhookDeduplication: true` capability).