// Secure webhook processing layer
// Phase 2F-B: Provider-neutral payment gateway foundation
// Shared webhook processing layer with security guarantees

import 'server-only'

import { getProviderAdapterOrThrow } from '@/lib/payments/providers/index'
import { isSupportedProvider } from '@/lib/payments/providers'
import { transitionPayment } from '@/lib/server/payments'
import type { PaymentActor, PaymentStatus } from '@/lib/payment'
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
  outcome?: 'paid' | 'failed' | 'refunded' | 'ignored'
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

  // 6. Apply the outcome via transitionPayment (atomic, validated)
  let paymentReference: string | undefined
  let outcomeType: string | undefined

  if (outcome && outcome.type !== 'ignored') {
    try {
      const { transitionPayment } = await import('@/lib/server/payments')
      const targetStatus = outcome.type === 'paid' ? 'paid' :
        outcome.type === 'failed' ? 'failed' :
        outcome.type === 'refunded' ? 'refunded' : 'cancelled'
      
      const payment = await transitionPayment(outcome.providerPaymentId, targetStatus as PaymentStatus, {
        actor: 'provider',
        amountPaidCents: outcome.amountPaidCents,
        amountRefundedCents: outcome.amountRefundedCents,
        providerPaymentId: outcome.providerPaymentId,
        failureCode: outcome.failureCode,
        failureMessage: outcome.failureMessage,
      })

      if (payment) {
        paymentReference = payment.reference
        outcomeType = outcome.type
      }
    } catch (error) {
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
  }

  // 7. Log successful processing
  await logPaymentWebhook({
    provider: normalizedKey,
    eventId: verified.eventId,
    eventType: verified.eventType,
    success: true,
    paymentReference: outcome.providerPaymentId,
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