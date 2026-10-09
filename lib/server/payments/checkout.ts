// Secure checkout orchestration
// Phase 2F-B: Provider-neutral payment gateway foundation
// Handles checkout session creation, validation, and provider handoff

import 'server-only'

import { db } from '@/lib/server/db'
import { getDefaultProvider, hasEnabledProvider, getProviderAdapterOrThrow, getEnabledProviders } from '@/lib/payments/providers/index'
import { initiateCustomerPayment, validatePaymentInitiation, type ValidatedPaymentInitiation } from '@/lib/server/payments'
import { getCurrentUser } from '@/lib/server/auth'
import { ConfigurationError, ValidationError, AuthorizationError, NotFoundError } from '@/lib/server/errors'

/** Result of a checkout session creation */
export interface CheckoutSessionResult {
  /** The payment reference (SP-PAY-XXXXXX) */
  paymentReference: string
  /** The provider's payment ID (if immediately available) */
  providerPaymentId?: string
  /** URL to redirect the customer for provider-hosted checkout */
  redirectUrl?: string
  /** Whether a new payment was created (vs reusing existing) */
  created: boolean
  /** Provider metadata for the handoff */
  providerMetadata?: Record<string, string>
}

/** Options for creating a checkout session */
export interface CreateCheckoutSessionOptions {
  /** The booking reference to pay for */
  bookingReference: string
  /** Client-generated idempotency key */
  idempotencyKey: string
  /** URL to redirect after successful payment */
  returnUrl: string
  /** URL to redirect if customer cancels */
  cancelUrl: string
  /** Optional customer email (for guest payments) */
  customerEmail?: string
  /** Optional customer name (for guest payments) */
  customerName?: string
  /** Optional metadata to pass to provider */
  metadata?: Record<string, string>
}

/**
 * Creates a checkout session for a booking.
 * This is the main entry point for initiating a payment flow.
 * It validates the booking, creates/reuses a PENDING payment,
 * and requests a checkout session from the configured provider.
 *
 * @throws {ValidationError} If input validation fails
 * @throws {NotFoundError} If booking not found
 * @throws {AuthorizationError} If customer doesn't own the booking
 * @throws {ConfigurationError} If no payment provider is configured
 * @throws {Error} If provider initiation fails
 */
export async function createCheckoutSession(
  options: CreateCheckoutSessionOptions
): Promise<CheckoutSessionResult> {
  // 1. Validate that at least one provider is enabled
  if (!hasEnabledProvider()) {
    throw new ConfigurationError('No payment provider is configured. Please configure a payment provider to accept payments.')
  }

  // 2. Validate input
  const input = validatePaymentInitiation({
    bookingReference: options.bookingReference,
    idempotencyKey: options.idempotencyKey,
  })

  // 3. Get the default provider (first enabled)
  const defaultProvider = getDefaultProvider()
  if (!defaultProvider) {
    throw new ConfigurationError('No payment provider is configured.')
  }

  // 4. Get the provider adapter
  const adapter = getProviderAdapterOrThrow(defaultProvider.key as any)

  // 5. Validate webhook deduplication capability (FAIL CLOSED)
  // Production payment activation requires persistent webhook event
  // deduplication support (unique index on providerEventId).
  if (!adapter.metadata.capabilities.webhookDeduplication) {
    throw new ConfigurationError(
      `Payment provider "${defaultProvider.key}" does not support webhook deduplication. ` +
      `Persistent event deduplication (unique providerEventId) is required for production activation. ` +
      `Set webhookDeduplication: true in adapter capabilities after migration.`
    )
  }

  // 6. Get current user (for authenticated customers)
  const currentUser = await getCurrentUser()

  // 5. Initiate payment via core service (creates/reuses PENDING payment)
  // This validates booking ownership, amount, status, etc.
  let userId: string | null = null
  if (currentUser && currentUser.roles.includes('CUSTOMER')) {
    userId = currentUser.id
  }

  // Use the core payment initiation (handles booking validation, dedup, etc.)
  const { payment, created } = await initiateCustomerPayment(userId ?? '', input)

  // 6. If payment was newly created, request checkout session from provider
  let providerPaymentId = payment.providerPaymentId ?? undefined
  let redirectUrl: string | undefined
  let providerMetadata: Record<string, string> | undefined

  if (created) {
    // Request checkout session from provider
    const handoff = await adapter.initiate({
      reference: payment.reference,
      amountCents: Math.round(payment.amount * 100),
      currency: payment.currency,
      idempotencyKey: input.idempotencyKey,
      customerEmail: options.customerEmail ?? (payment as any).contactEmail,
      customerName: options.customerName ?? (payment as any).contactName,
      returnUrl: options.returnUrl,
      cancelUrl: options.cancelUrl,
      metadata: options.metadata,
    })

    // Validate handoff response
    if (!handoff.providerPaymentId) {
      throw new Error('Provider did not return a providerPaymentId')
    }
    if (!handoff.redirectUrl) {
      throw new Error('Provider did not return a redirectUrl for checkout')
    }

    providerPaymentId = handoff.providerPaymentId
    redirectUrl = handoff.redirectUrl
    providerMetadata = handoff.metadata
  }

  // 7. Return checkout session result
  return {
    paymentReference: payment.reference,
    providerPaymentId,
    redirectUrl,
    created,
    providerMetadata,
  }
}

/**
 * Validates that a checkout session can be created for a booking.
 * Used by the API to pre-validate before creating the session.
 */
export async function validateCheckoutEligibility(
  bookingReference: string,
  userId: string | null
): Promise<{ eligible: boolean; reason?: string }> {
  try {
    const input = validatePaymentInitiation({ bookingReference, idempotencyKey: 'validation-check' })
    const booking = await db.booking.findUnique({
      where: { reference: input.bookingReference },
      select: { id: true, userId: true, status: true, total: true, currency: true, paymentStatus: true },
    })

    if (!booking) {
      return { eligible: false, reason: 'Booking not found' }
    }

    // Guest bookings require special handling (token-based)
    if (!booking.userId && !userId) {
      return { eligible: false, reason: 'Guest bookings require a payment token' }
    }

    // Ownership check for authenticated users
    if (userId && booking.userId && booking.userId !== userId) {
      return { eligible: false, reason: 'Unauthorized' }
    }

    // Status checks
    if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
      return { eligible: false, reason: 'Booking is not payable' }
    }

    if (Number(booking.total) <= 0) {
      return { eligible: false, reason: 'Booking has no amount due' }
    }

    return { eligible: true }
  } catch (error) {
    if (error instanceof Error) {
      return { eligible: false, reason: error.message }
    }
    return { eligible: false, reason: 'Invalid request' }
  }
}

/**
 * Gets the checkout session status for a payment reference.
 * Used for polling or displaying current status.
 */
export async function getCheckoutSessionStatus(
  paymentReference: string,
  userId: string | null
): Promise<{
  paymentReference: string
  status: string
  providerStatus?: string
  redirectUrl?: string
  amount: number
  currency: string
}> {
  const { getCustomerPayment } = await import('@/lib/server/payments')
  const payment = await getCustomerPayment(userId ?? '', paymentReference)
  
  if (!payment) {
    throw new Error('Payment not found')
  }

  return {
    paymentReference: payment.reference,
    status: payment.status,
    providerStatus: payment.provider,
    redirectUrl: undefined,
    amount: payment.amount,
    currency: payment.currency,
  }
}

/**
 * Checks if a provider is configured and available.
 * Used by UI to show/hide payment options.
 */
export function getAvailableProviders(): Array<{
  key: string
  name: string
  testMode: boolean
}> {
  return getEnabledProviders().map((p: { key: string; name: string; testMode: boolean }) => ({
    key: p.key,
    name: p.name,
    testMode: p.testMode,
  }))
}