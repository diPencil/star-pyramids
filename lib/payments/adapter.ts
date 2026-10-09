// Payment provider adapter contracts and shared types
// Phase 2F-B: Provider-neutral payment gateway foundation
// Extends the core PaymentProviderAdapter with additional capabilities

import type { PaymentProviderKey, PaymentHandoff, ProviderCallbackOutcome } from '@/lib/payment'

/** Extended provider capabilities — providers declare what they support */
export interface ProviderCapabilities {
  /** Supports immediate payment capture (vs authorize+capture) */
  immediateCapture: boolean
  /** Supports authorize-then-capture flow */
  authorizeCapture: boolean
  /** Supports refunds via API */
  refunds: boolean
  /** Supports partial refunds */
  partialRefunds: boolean
  /** Supports voiding authorized payments */
  voids: boolean
  /** Supports 3D Secure / SCA */
  threeDSecure: boolean
  /** Supported currencies (ISO 4217) */
  supportedCurrencies: string[]
  /** Minimum amount in minor units (cents) */
  minAmountCents: number
  /** Maximum amount in minor units (cents) */
  maxAmountCents: number
  /** Supports customer payment method storage */
  paymentMethodStorage: boolean
  /** Supports webhook retries with exponential backoff */
  webhookRetries: boolean
  /** Webhook signature algorithm */
  signatureAlgorithm: 'hmac-sha256' | 'rsa-sha256' | 'custom'
  /** Whether webhook includes full payment object or just event ID */
  webhookPayloadType: 'full' | 'event-id-only'
  /** Provider supports persistent webhook event deduplication via eventId.
   * Requires database schema with unique index on providerEventId.
   * If false, production activation is blocked. */
  webhookDeduplication: boolean
}

/** Provider metadata for registration and display */
export interface ProviderMetadata {
  key: PaymentProviderKey
  name: string
  version: string
  capabilities: ProviderCapabilities
  /** Required configuration keys for this provider */
  requiredConfig: string[]
  /** Optional configuration keys */
  optionalConfig: string[]
  /** Webhook endpoint path suffix (e.g., 'stripe' -> /api/payments/webhook/stripe) */
  webhookPath: string
  /** Supported webhook event types */
  webhookEvents: string[]
}

/**
 * Extended provider adapter with capabilities and metadata
 * Implementations MUST provide all required methods and metadata
 */
export interface ExtendedPaymentProviderAdapter {
  /** Provider key — must match registration key */
  readonly key: PaymentProviderKey
  /** Provider metadata for registration */
  readonly metadata: ProviderMetadata
  /**
   * Initiate a checkout session for an existing PENDING payment.
   * MUST be idempotent on the payment's idempotencyKey.
   * Returns a handoff with redirect URL for provider-hosted checkout,
   * or providerPaymentId for embedded flows.
   */
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

  /**
   * Verify and normalize an inbound provider webhook.
   * MUST perform signature verification, timestamp validation, and replay protection.
   * Returns a normalized outcome for the core to apply via transitionPayment().
   */
  handleCallback(rawBody: string, headers: Headers): Promise<ProviderCallbackOutcome>

  /**
   * Optional: Create a refund for a paid payment.
   * Only required if capabilities.refunds === true.
   */
  createRefund?(params: {
    providerPaymentId: string
    amountCents: number
    reason?: string
    idempotencyKey: string
  }): Promise<{ refundId: string; status: string }>

  /**
   * Optional: Void an authorized but uncaptured payment.
   * Only required if capabilities.voids === true.
   */
  voidPayment?(params: {
    providerPaymentId: string
    idempotencyKey: string
  }): Promise<{ status: string }>

  /**
   * Optional: Capture an authorized payment.
   * Only required if capabilities.authorizeCapture === true.
   */
  capturePayment?(params: {
    providerPaymentId: string
    amountCents: number
    idempotencyKey: string
  }): Promise<{ status: string }>

  /**
   * Optional: Get payment status from provider (for reconciliation).
   */
  getPaymentStatus?(providerPaymentId: string): Promise<{
    status: string
    amountCents: number
    capturedCents: number
    refundedCents: number
  }>

  /**
   * Validate webhook signature and timestamp.
   * Called by the shared webhook handler before handleCallback.
   * Returns parsed/verified payload or throws on verification failure.
   */
  verifyWebhook(rawBody: string, headers: Headers): Promise<{
    eventId: string
    eventType: string
    timestamp: number
    payload: unknown
  }>
}

/**
 * Creates a minimal PaymentProviderAdapter from an ExtendedPaymentProviderAdapter
 * for backward compatibility with the core PaymentProviderAdapter interface.
 */
export function toCoreAdapter(extended: ExtendedPaymentProviderAdapter): {
  key: PaymentProviderKey
  initiate: (payment: { reference: string; amountCents: number; currency: 'USD'; idempotencyKey: string | null }) => Promise<PaymentHandoff>
  handleCallback: (rawBody: string, headers: Headers) => Promise<ProviderCallbackOutcome>
} {
  return {
    key: extended.key,
    initiate: (payment) => extended.initiate({
      ...payment,
      returnUrl: '', // Will be filled by checkout orchestration
      cancelUrl: '',
    }),
    handleCallback: extended.handleCallback,
  }
}

/**
 * Validates that a provider adapter implements all required methods.
 * Throws if any required method is missing.
 */
export function validateAdapter(adapter: ExtendedPaymentProviderAdapter): void {
  if (!adapter.key || typeof adapter.key !== 'string') {
    throw new Error('Adapter must have a string key')
  }
  if (!adapter.metadata || typeof adapter.metadata !== 'object') {
    throw new Error('Adapter must have metadata')
  }
  if (typeof adapter.initiate !== 'function') {
    throw new Error('Adapter must implement initiate()')
  }
  if (typeof adapter.handleCallback !== 'function') {
    throw new Error('Adapter must implement handleCallback()')
  }
  if (typeof adapter.verifyWebhook !== 'function') {
    throw new Error('Adapter must implement verifyWebhook()')
  }
  if (!adapter.metadata.key || adapter.metadata.key !== adapter.key) {
    throw new Error('Adapter metadata.key must match adapter.key')
  }
  if (!adapter.metadata.capabilities) {
    throw new Error('Adapter metadata must include capabilities')
  }
}

/**
 * Default capabilities for a basic payment provider.
 * Providers should override with their actual capabilities.
 * webhookDeduplication defaults to FALSE to fail closed until
 * persistent deduplication schema is available.
 */
export const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  immediateCapture: true,
  authorizeCapture: false,
  refunds: true,
  partialRefunds: true,
  voids: false,
  threeDSecure: false,
  supportedCurrencies: ['USD'],
  minAmountCents: 50, // $0.50
  maxAmountCents: 9999999, // $99,999.99
  paymentMethodStorage: false,
  webhookRetries: true,
  signatureAlgorithm: 'hmac-sha256',
  webhookPayloadType: 'full',
  webhookDeduplication: false,
}

/**
 * Creates a base provider metadata object with defaults.
 * Providers should extend this with their specific metadata.
 */
export function createProviderMetadata(
  key: PaymentProviderKey,
  name: string,
  overrides: Partial<ProviderMetadata> = {}
): ProviderMetadata {
  return {
    key,
    name,
    version: '1.0.0',
    capabilities: DEFAULT_CAPABILITIES,
    requiredConfig: [],
    optionalConfig: [],
    webhookPath: key,
    webhookEvents: [],
    ...overrides,
  }
}