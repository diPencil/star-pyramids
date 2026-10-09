// Payment webhook endpoint
// Phase 2F-B: Provider-neutral payment gateway foundation
// Handles inbound webhooks from payment providers with full security validation

import { createWebhookHandler, createWebhookVerificationHandler } from '@/lib/server/webhooks/handler'

/** Supported provider keys */
const SUPPORTED_PROVIDERS = ['stripe', 'paypal', 'adyen'] as const
type SupportedProvider = typeof SUPPORTED_PROVIDERS[number]

/** Validates that the provider parameter is supported */
function validateProvider(provider: string): provider is SupportedProvider {
  return SUPPORTED_PROVIDERS.includes(provider as SupportedProvider)
}

/** Disable default body parser to get raw body for signature verification */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Webhook POST handler - processes inbound payment events */
export const POST = async (
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
): Promise<Response> => {
  const { provider } = await params

  if (!validateProvider(provider)) {
    return new Response(
      JSON.stringify({ error: 'Unsupported payment provider', code: 'UNSUPPORTED_PROVIDER' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Import the handler dynamically to avoid circular dependencies
  const { handleProviderWebhook } = await import('@/lib/server/webhooks/handler')

  try {
    // Read raw body once (requires bodyParser: false equivalent - runtime = 'nodejs')
    const rawBody = await request.text()
    const headers = new Headers(request.headers)

    // Process webhook
    const result = await handleProviderWebhook(provider, rawBody, headers)

    // Return 200 to acknowledge receipt (even for verification failures,
    // we return 2xx to prevent retries for auth failures per webhook best practices)
    return new Response(
      JSON.stringify({ received: true, paymentReference: result.paymentReference }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    // Handle known webhook errors
    if (error instanceof Error && error.name === 'WebhookError') {
      const webhookError = error as any
      return new Response(
        JSON.stringify({ error: webhookError.message, code: webhookError.code }),
        { status: webhookError.statusCode, headers: { 'Content-Type': 'application/json' } }
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

/** Webhook GET handler for verification challenges (e.g., Stripe) */
export const GET = async (
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
): Promise<Response> => {
  const { provider } = await params

  if (!validateProvider(provider)) {
    return new Response(
      JSON.stringify({ error: 'Unsupported payment provider', code: 'UNSUPPORTED_PROVIDER' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const url = new URL(request.url)
  const challenge = url.searchParams.get('challenge') || url.searchParams.get('hub.challenge')

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