// Secure webhook processing layer
// Phase 2F-B: Provider-neutral payment gateway foundation
// Shared webhook processing layer with security guarantees

import 'server-only'

import { getProviderAdapterOrThrow } from '@/lib/payments/providers/index'
import { isSupportedProvider } from '@/lib/payments/providers'
import {
  DuplicateWebhookEvent,
  findPaymentByProviderId,
  PaidOnCancelledBooking,
  transitionPayment,
} from '@/lib/server/payments'
import {
  checkWebhookMoney,
  mapProviderOutcomeToStatus,
  type PaymentActor,
  type PaymentStatus,
} from '@/lib/payment'
import { logPaymentWebhook } from '@/lib/server/logging'
import { WebhookError } from '@/lib/server/errors'

/** Result of webhook processing */
export interface WebhookProcessingResult {
  /** Whether the webhook was processed successfully */
  success: boolean
  /** The payment reference that was affected */
  paymentReference?: string
  /** The provider event ID */
  providerEventId?: string
  /** The outcome type */
  outcome?: 'paid' | 'failed' | 'refunded' | 'partially_refunded' | 'ignored'
  /** Error message if failed */
  error?: string
}

/** Webhook verification result from provider adapter */
export interface VerifiedWebhookPayload {
  /** Unique provider event ID for deduplication */
  eventId: string
  /** Type of event (e.g., 'payment_intent.succeeded') */
  eventType: string
  /** Unix timestamp of the event */
  timestamp: number
  /** Raw parsed payload */
  payload: unknown
}

/** Webhook handler options */
export interface WebhookHandlerOptions {
  /** Maximum age of webhook timestamp in seconds (default: 300 = 5 minutes) */
  maxTimestampAgeSeconds?: number
  /** Whether to require exact amount match (default: true) */
  requireExactAmountMatch?: boolean
  /** Whether to require currency match (default: true) */
  requireCurrencyMatch?: boolean
}

/** Maximum allowed age for webhook timestamps (5 minutes default) */
export const DEFAULT_MAX_TIMESTAMP_AGE_SECONDS = 300

/**
 * Parses the raw request body as text.
 * Must be used with Next.js route config: export const config = { api: { bodyParser: false } }
 */
export async function getRawBody(request: Request): Promise<string> {
  const reader = request.body?.getReader()
  if (!reader) {
    throw new Error('Request body is not readable')
  }

  const chunks: Uint8Array[] = []
  let done = false
  while (!done) {
    const { done: readerDone, value } = await reader.read()
    done = readerDone
    if (value) chunks.push(value)
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return new TextDecoder().decode(result)
}

/**
 * Validates webhook timestamp is within acceptable range.
 * Throws WebhookError if timestamp is too old or in the future.
 */
export function validateTimestamp(
  timestamp: number,
  maxAgeSeconds: number = DEFAULT_MAX_TIMESTAMP_AGE_SECONDS
): void {
  const now = Math.floor(Date.now() / 1000)
  const age = now - timestamp

  if (age > maxAgeSeconds) {
    throw new WebhookError(
      `Webhook timestamp too old: ${age}s > ${maxAgeSeconds}s`,
      'INVALID_TIMESTAMP',
      400
    )
  }

  // Allow small future tolerance (1 minute) for clock skew
  if (timestamp > now + 60) {
    throw new WebhookError(
      'Webhook timestamp is in the future',
      'INVALID_TIMESTAMP',
      400
    )
  }
}

/**
 * Normalizes webhook headers to a plain object.
 * Headers are case-insensitive.
 */
export function normalizeHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value
  })
  return result
}

/**
 * Extracts the provider key from the request URL.
 * Expects URL pattern: /api/payments/webhook/[provider]
 */
export function getProviderFromUrl(url: string): string | null {
  const match = url.match(/\/api\/payments\/webhook\/([^/?#]+)/)
  return match ? match[1] : null
}

/**
 * Core webhook handler that performs shared security checks
 * and delegates to the provider-specific adapter.
 */
export async function handleProviderWebhook(
  providerKey: string,
  rawBody: string,
  headers: Headers,
  options: WebhookHandlerOptions = {}
): Promise<{
  success: boolean
  paymentReference?: string
  providerEventId?: string
  outcome?: string
  error?: string
}> {
  const startTime = Date.now()

  // 1. Validate provider key
  if (!providerKey || typeof providerKey !== 'string') {
    throw new WebhookError('Missing provider key in URL', 'UNKNOWN_PROVIDER', 400)
  }

  // Normalize provider key to lowercase
  const normalizedKey = providerKey.toLowerCase()

  if (!['stripe', 'paypal', 'adyen'].includes(normalizedKey)) {
    throw new WebhookError(`Unsupported provider: ${normalizedKey}`, 'UNKNOWN_PROVIDER', 404)
  }

  // 2. Get the provider adapter
  let adapter: any
  try {
    adapter = getProviderAdapterOrThrow(normalizedKey as any)
  } catch {
    throw new WebhookError(`Provider adapter not registered: ${normalizedKey}`, 'UNKNOWN_PROVIDER', 503)
  }

  // 3. Verify webhook signature and parse payload
  let verified: { eventId: string; eventType: string; timestamp: number; payload: any }
  try {
    verified = await adapter.verifyWebhook(rawBody, headers)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown verification error'
    await logPaymentWebhook({
      provider: normalizedKey,
      eventId: 'unknown',
      eventType: 'verification_failed',
      success: false,
      error: `Signature verification failed: ${message}`,
      durationMs: Date.now() - startTime,
    })
    throw new WebhookError(`Signature verification failed: ${message}`, 'INVALID_SIGNATURE', 401)
  }

  // 4. Validate timestamp
  try {
    validateTimestamp(verified.timestamp)
  } catch (error) {
    if (error instanceof Error) {
      throw new WebhookError(error.message, 'INVALID_TIMESTAMP', 400)
    }
    throw new WebhookError('Invalid timestamp', 'INVALID_TIMESTAMP', 400)
  }

  // 5. Replay protection: require providerEventId for deduplication.
  // Persistent deduplication requires a database migration to add
  // providerEventId to PaymentEvent with a unique index.
  // FAIL CLOSED: If provider doesn't supply eventId, reject the webhook.
  const providerEventId = verified.eventId
  if (!providerEventId) {
    await logPaymentWebhook({
      provider: normalizedKey,
      eventId: 'unknown',
      eventType: verified.eventType,
      success: false,
      error: 'Webhook missing eventId - persistent deduplication unavailable',
      durationMs: Date.now() - startTime,
    })
    throw new WebhookError(
      'Webhook missing eventId: persistent deduplication not available',
      'REPLAY_DETECTED',
      400
    )
  }

  // 6. Delegate to provider-specific callback handler
  let outcome: any
  try {
    outcome = await adapter.handleCallback(rawBody, headers as any)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown callback error'
    await logPaymentWebhook({
      provider: normalizedKey,
      eventId: verified.eventId,
      eventType: verified.eventType,
      success: false,
      error: `Callback processing failed: ${message}`,
      durationMs: Date.now() - startTime,
    })
    throw new WebhookError(`Callback processing failed: ${message}`, 'PROCESSING_FAILED', 500)
  }

  // 6. Explicitly ignored outcomes mutate nothing.
  if (!outcome || outcome.type === 'ignored') {
    await logPaymentWebhook({
      provider: normalizedKey,
      eventId: verified.eventId,
      eventType: verified.eventType,
      success: true,
      durationMs: Date.now() - startTime,
    })
    return { success: true, providerEventId: verified.eventId, outcome: 'ignored' }
  }

  // 7. Resolve the INTERNAL payment record by the verified provider
  // identifier (unique `providerPaymentId`). Our `reference` is never
  // accepted from the provider — passing their id as our reference
  // can never match a record and silently drops every webhook.
  const providerPaymentId =
    typeof outcome.providerPaymentId === 'string' ? outcome.providerPaymentId.trim() : ''
  if (!providerPaymentId) {
    await logPaymentWebhook({
      provider: normalizedKey,
      eventId: verified.eventId,
      eventType: verified.eventType,
      success: false,
      error: 'Webhook outcome missing provider payment identifier',
      durationMs: Date.now() - startTime,
    })
    throw new WebhookError('Webhook outcome missing provider payment identifier', 'INVALID_PAYLOAD', 400)
  }
  const internal = await findPaymentByProviderId(providerPaymentId)
  if (!internal) {
    await logPaymentWebhook({
      provider: normalizedKey,
      eventId: verified.eventId,
      eventType: verified.eventType,
      success: false,
      error: 'Unknown payment for provider payment identifier',
      durationMs: Date.now() - startTime,
    })
    throw new WebhookError('Unknown payment for provider payment identifier', 'INVALID_PAYLOAD', 404)
  }

  // 8. Map to an internal status. Unrecognized outcome types are
  // acknowledged WITHOUT mutation — never interpreted as cancellation.
  const refundedCents =
    outcome.type === 'refunded' ? outcome.amountRefundedCents : undefined
  const targetStatus = mapProviderOutcomeToStatus(outcome.type, refundedCents, internal.amountCents)
  if (targetStatus === 'ignored' || targetStatus === 'unknown') {
    await logPaymentWebhook({
      provider: normalizedKey,
      eventId: verified.eventId,
      eventType: verified.eventType,
      success: true,
      paymentReference: internal.reference,
      durationMs: Date.now() - startTime,
    })
    return {
      success: true,
      paymentReference: internal.reference,
      providerEventId: verified.eventId,
      outcome: 'ignored',
    }
  }

  // 9. Money validation for money-moving outcomes. Comparisons run in
  // integer minor units against the authoritative STORED payment —
  // never client-displayed totals. Fail closed: missing, malformed,
  // or mismatched amounts/currencies never mark anything PAID and
  // mutate nothing. 'failed' moves no money and carries no requirement.
  const moneyCheck = checkWebhookMoney({
    outcomeType: outcome.type,
    amountPaidCents: outcome.type === 'paid' ? outcome.amountPaidCents : undefined,
    amountRefundedCents: outcome.type === 'refunded' ? outcome.amountRefundedCents : undefined,
    outcomeCurrency:
      outcome.type === 'paid' || outcome.type === 'refunded' || outcome.type === 'failed'
        ? outcome.currency
        : undefined,
    storedAmountCents: internal.amountCents,
    storedCurrency: internal.currency,
    requireExactAmount: options.requireExactAmountMatch !== false,
    requireCurrency: options.requireCurrencyMatch !== false,
  })
  if (!moneyCheck.ok) {
    await logPaymentWebhook({
      provider: normalizedKey,
      eventId: verified.eventId,
      eventType: verified.eventType,
      success: false,
      paymentReference: internal.reference,
      error: `Money validation failed: ${moneyCheck.reason} (expected ${internal.amountCents} minor units ${internal.currency})`,
      durationMs: Date.now() - startTime,
    })
    throw new WebhookError(
      `Money validation failed: ${moneyCheck.reason}`,
      'INVALID_PAYLOAD',
      400,
    )
  }

  // 10. Duplicate delivery: the record already carries this exact outcome —
  // acknowledge without mutating (idempotent redelivery, no new event row).
  const incomingPaidCents =
    outcome.type === 'paid' ? (outcome.amountPaidCents ?? internal.amountPaidCents) : undefined
  const incomingRefundedCents =
    outcome.type === 'refunded' ? (outcome.amountRefundedCents ?? internal.amountCents) : undefined
  const alreadyApplied =
    (targetStatus === 'paid' &&
      internal.status === 'paid' &&
      internal.amountPaidCents === incomingPaidCents) ||
    (targetStatus === 'failed' && internal.status === 'failed') ||
    ((targetStatus === 'refunded' || targetStatus === 'partially_refunded') &&
      internal.status === targetStatus &&
      internal.amountRefundedCents === incomingRefundedCents)
  if (alreadyApplied) {
    await logPaymentWebhook({
      provider: normalizedKey,
      eventId: verified.eventId,
      eventType: verified.eventType,
      success: true,
      paymentReference: internal.reference,
      durationMs: Date.now() - startTime,
    })
    return {
      success: true,
      paymentReference: internal.reference,
      providerEventId: verified.eventId,
      outcome: targetStatus,
    }
  }

  // 11. Apply the outcome via transitionPayment (atomic, validated).
  // Out-of-order events fail its transition guard and surface as a
  // retryable error so the provider redelivers after earlier events.
  // The verified event id travels with the transition so the unique
  // claim absorbs concurrent redeliveries inside the same commit.
  let paymentReference: string | undefined
  let outcomeType: string | undefined
  try {
    const payment = await transitionPayment(internal.reference, targetStatus, {
      actor: 'provider',
      amountPaidCents: incomingPaidCents,
      amountRefundedCents: incomingRefundedCents,
      providerPaymentId,
      failureCode: outcome.type === 'failed' ? outcome.failureCode : undefined,
      failureMessage: outcome.type === 'failed' ? outcome.failureMessage : undefined,
      providerEventId: verified.eventId,
    })

    if (payment) {
      paymentReference = payment.reference
      outcomeType = targetStatus
    }
  } catch (error) {
    // Concurrent redelivery already committed this exact event: resolve
    // the settled record fresh and acknowledge idempotently — no second
    // transition, no second audit row.
    if (error instanceof DuplicateWebhookEvent) {
      const settled = await findPaymentByProviderId(providerPaymentId)
      await logPaymentWebhook({
        provider: normalizedKey,
        eventId: verified.eventId,
        eventType: verified.eventType,
        success: true,
        paymentReference: settled?.reference ?? internal.reference,
        durationMs: Date.now() - startTime,
      })
      return {
        success: true,
        paymentReference: settled?.reference ?? internal.reference,
        providerEventId: verified.eventId,
        outcome: targetStatus,
      }
    }
    // Verified money for a cancelled booking: settling would corrupt
    // the ledger, and retrying can never succeed. Acknowledge (no
    // retry storm) with full evidence preserved for reconciliation.
    if (error instanceof PaidOnCancelledBooking) {
      await logPaymentWebhook({
        provider: normalizedKey,
        eventId: verified.eventId,
        eventType: verified.eventType,
        success: false,
        paymentReference: internal.reference,
        error:
          `Paid settlement refused: booking is cancelled ` +
          `(payment ${internal.reference}, provider ${providerPaymentId}, ` +
          `${incomingPaidCents ?? internal.amountPaidCents} minor units). ` +
          `Reconcile manually; do not auto-refund from this path.`,
        durationMs: Date.now() - startTime,
      })
      return {
        success: true,
        paymentReference: internal.reference,
        providerEventId: verified.eventId,
        outcome: 'requires_review',
      }
    }
    const message = error instanceof Error ? error.message : 'Unknown transition error'
    await logPaymentWebhook({
      provider: normalizedKey,
      eventId: verified.eventId,
      eventType: verified.eventType,
      success: false,
      error: `Payment transition failed: ${message}`,
      durationMs: Date.now() - startTime,
    })
    throw new WebhookError(`Payment transition failed: ${message}`, 'PROCESSING_FAILED', 500)
  }

  // 12. Log successful processing
  await logPaymentWebhook({
    provider: normalizedKey,
    eventId: verified.eventId,
    eventType: verified.eventType,
    success: true,
    paymentReference,
    durationMs: Date.now() - startTime,
  })

  return {
    success: true,
    paymentReference,
    providerEventId: verified.eventId,
    outcome: outcomeType,
  }
}

/**
 * Creates a Next.js API route handler for webhooks.
 * Usage:
 *   export const POST = createWebhookHandler('stripe')
 *   export const config = { api: { bodyParser: false } }
 */
export function createWebhookHandler(providerKey: string) {
  return async function POST(request: Request): Promise<Response> {
    const startTime = Date.now()

    try {
      // 1. Read raw body (requires bodyParser: false in route config)
      const rawBody = await getRawBody(request)

      // 2. Get headers
      const headersList = await import('next/headers').then(m => m.headers())
      const headersObj: Headers = new Headers()
      headersList.forEach((value, key) => {
        headersObj.append(key, value)
      })

      // 3. Process webhook
      const result = await handleProviderWebhook(providerKey, rawBody, headersObj)

      // 4. Return success (2xx) to acknowledge receipt
      return new Response(
        JSON.stringify({ received: true, paymentReference: result.paymentReference }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      if (error instanceof WebhookError) {
        // Return appropriate error status but still 2xx to acknowledge receipt
        // (per webhook best practices - we don't want retries for auth failures)
        return new Response(
          JSON.stringify({ error: error.message, code: error.code }),
          { status: error.statusCode, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Unexpected error - log and return 500
      console.error('Webhook processing error:', error)
      return new Response(
        JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
}

/**
 * Creates a GET handler for webhook verification (some providers require this).
 * Returns 200 OK with challenge if verification challenge is present.
 */
export function createWebhookVerificationHandler(providerKey: string) {
  return async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const challenge = new URL(request.url).searchParams.get('challenge') || new URL(request.url).searchParams.get('hub.challenge')

    if (challenge) {
      // Return the challenge for verification
      return new Response(
        JSON.stringify({ challenge }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Verification challenge required', code: 'CHALLENGE_REQUIRED' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Validates that the webhook secret is configured for a provider.
 * Throws if not configured.
 */
export function validateWebhookSecretConfigured(providerKey: string): void {
  const secretKey = `${providerKey.toUpperCase()}_WEBHOOK_SECRET`
  if (!process.env[secretKey]) {
    throw new Error(`Webhook secret not configured for ${providerKey}. Set ${secretKey} environment variable.`)
  }
}

export { WebhookError } from '@/lib/server/errors'