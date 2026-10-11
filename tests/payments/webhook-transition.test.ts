// Regression tests for the critical payment-webhook fix:
// internal records resolve by providerPaymentId (never by reference),
// unknown outcomes never cancel, duplicates never re-mutate.
// All provider/DB boundaries are mocked — no production records touched.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mapProviderOutcomeToStatus } from '@/lib/payment'

vi.mock('@/lib/server/db', () => ({ db: {} }))
vi.mock('@/lib/server/logging', () => ({ logPaymentWebhook: vi.fn() }))
vi.mock('@/lib/server/payments', () => ({
  transitionPayment: vi.fn(),
  findPaymentByProviderId: vi.fn(),
}))
vi.mock('@/lib/payments/providers/index', () => ({
  getProviderAdapterOrThrow: vi.fn(),
}))

import { handleProviderWebhook, WebhookError } from '@/lib/server/webhooks/handler'
import { transitionPayment, findPaymentByProviderId } from '@/lib/server/payments'
import { getProviderAdapterOrThrow } from '@/lib/payments/providers/index'

const nowSec = () => Math.floor(Date.now() / 1000)

function mockAdapter(outcome: unknown) {
  return {
    verifyWebhook: vi.fn().mockResolvedValue({
      eventId: 'evt_123',
      eventType: 'payment_intent.succeeded',
      timestamp: nowSec(),
      payload: {},
    }),
    handleCallback: vi.fn().mockResolvedValue(outcome),
  }
}

function useAdapter(outcome: unknown) {
  vi.mocked(getProviderAdapterOrThrow).mockReturnValue(mockAdapter(outcome) as never)
}

const PENDING_PAYMENT = {
  reference: 'SP-PAY-ABC123',
  status: 'pending',
  amountCents: 10000,
  amountPaidCents: 0,
  amountRefundedCents: 0,
  currency: 'USD',
} as const

const PAID_PAYMENT = {
  reference: 'SP-PAY-ABC123',
  status: 'paid',
  amountCents: 10000,
  amountPaidCents: 10000,
  amountRefundedCents: 0,
  currency: 'USD',
} as const

describe('mapProviderOutcomeToStatus (pure)', () => {
  it('maps paid and failed directly', () => {
    expect(mapProviderOutcomeToStatus('paid', undefined, 10000)).toBe('paid')
    expect(mapProviderOutcomeToStatus('failed', undefined, 10000)).toBe('failed')
  })

  it('keeps ignored as ignored', () => {
    expect(mapProviderOutcomeToStatus('ignored', undefined, 10000)).toBe('ignored')
  })

  it('splits full vs partial refunds on the settled amount', () => {
    expect(mapProviderOutcomeToStatus('refunded', 10000, 10000)).toBe('refunded')
    expect(mapProviderOutcomeToStatus('refunded', 4000, 10000)).toBe('partially_refunded')
    // Missing refund amount defaults to the full payment amount.
    expect(mapProviderOutcomeToStatus('refunded', undefined, 10000)).toBe('refunded')
  })

  it('marks unrecognized outcomes unknown (never cancelled)', () => {
    expect(mapProviderOutcomeToStatus('cancelled', undefined, 10000)).toBe('unknown')
    expect(mapProviderOutcomeToStatus('mystery_status', undefined, 10000)).toBe('unknown')
    expect(mapProviderOutcomeToStatus('', undefined, 10000)).toBe('unknown')
  })
})

describe('handleProviderWebhook transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('applies a recognized paid event to the resolved internal reference', async () => {
    useAdapter({ type: 'paid', amountPaidCents: 10000, currency: 'USD', providerPaymentId: 'pi_1' })
    vi.mocked(findPaymentByProviderId).mockResolvedValue({ ...PENDING_PAYMENT })
    vi.mocked(transitionPayment).mockResolvedValue({ reference: 'SP-PAY-ABC123' } as never)

    const result = await handleProviderWebhook('stripe', '{}', new Headers())

    expect(findPaymentByProviderId).toHaveBeenCalledWith('pi_1')
    expect(transitionPayment).toHaveBeenCalledWith(
      'SP-PAY-ABC123',
      'paid',
      expect.objectContaining({ actor: 'provider', amountPaidCents: 10000, providerPaymentId: 'pi_1' }),
    )
    expect(result).toMatchObject({ success: true, paymentReference: 'SP-PAY-ABC123', outcome: 'paid' })
  })

  it('applies a recognized failed event with failure details', async () => {
    useAdapter({ type: 'failed', failureCode: 'card_declined', failureMessage: 'Nope', providerPaymentId: 'pi_2' })
    vi.mocked(findPaymentByProviderId).mockResolvedValue({ ...PENDING_PAYMENT })
    vi.mocked(transitionPayment).mockResolvedValue({ reference: 'SP-PAY-ABC123' } as never)

    const result = await handleProviderWebhook('stripe', '{}', new Headers())

    expect(transitionPayment).toHaveBeenCalledWith(
      'SP-PAY-ABC123',
      'failed',
      expect.objectContaining({ failureCode: 'card_declined', failureMessage: 'Nope' }),
    )
    expect(result.outcome).toBe('failed')
  })

  it('maps a partial refund to partially_refunded, never full refunded', async () => {
    useAdapter({ type: 'refunded', amountRefundedCents: 4000, currency: 'USD', providerPaymentId: 'pi_3' })
    vi.mocked(findPaymentByProviderId).mockResolvedValue({ ...PAID_PAYMENT })
    vi.mocked(transitionPayment).mockResolvedValue({ reference: 'SP-PAY-ABC123' } as never)

    const result = await handleProviderWebhook('stripe', '{}', new Headers())

    expect(transitionPayment).toHaveBeenCalledWith(
      'SP-PAY-ABC123',
      'partially_refunded',
      expect.objectContaining({ amountRefundedCents: 4000 }),
    )
    expect(result.outcome).toBe('partially_refunded')
  })

  it('never interprets an unknown outcome as cancellation (acknowledged, no mutation)', async () => {
    useAdapter({ type: 'mystery_status', providerPaymentId: 'pi_9' })
    vi.mocked(findPaymentByProviderId).mockResolvedValue({ ...PENDING_PAYMENT })

    const result = await handleProviderWebhook('stripe', '{}', new Headers())

    expect(transitionPayment).not.toHaveBeenCalled()
    expect(result).toMatchObject({ success: true, outcome: 'ignored', paymentReference: 'SP-PAY-ABC123' })
  })

  it('ignores provider-ignored events without touching the database record', async () => {
    useAdapter({ type: 'ignored', reason: 'test event' })

    const result = await handleProviderWebhook('stripe', '{}', new Headers())

    expect(findPaymentByProviderId).not.toHaveBeenCalled()
    expect(transitionPayment).not.toHaveBeenCalled()
    expect(result).toMatchObject({ success: true, outcome: 'ignored' })
  })

  it('rejects invalid signatures before any record lookup', async () => {
    const bad = mockAdapter(null)
    bad.verifyWebhook.mockRejectedValue(new Error('bad signature'))
    vi.mocked(getProviderAdapterOrThrow).mockReturnValue(bad as never)

    await expect(handleProviderWebhook('stripe', '{}', new Headers())).rejects.toMatchObject({
      name: 'WebhookError',
      code: 'INVALID_SIGNATURE',
      statusCode: 401,
    })
    expect(findPaymentByProviderId).not.toHaveBeenCalled()
    expect(transitionPayment).not.toHaveBeenCalled()
  })

  it('rejects a validly-signed event for a wrong (unknown) payment reference', async () => {
    useAdapter({ type: 'paid', amountPaidCents: 10000, currency: 'USD', providerPaymentId: 'pi_unknown' })
    vi.mocked(findPaymentByProviderId).mockResolvedValue(null)

    await expect(handleProviderWebhook('stripe', '{}', new Headers())).rejects.toMatchObject({
      name: 'WebhookError',
      statusCode: 404,
    })
    expect(transitionPayment).not.toHaveBeenCalled()
  })

  it('acknowledges duplicate delivery without re-mutating', async () => {
    useAdapter({ type: 'paid', amountPaidCents: 10000, currency: 'USD', providerPaymentId: 'pi_1' })
    vi.mocked(findPaymentByProviderId).mockResolvedValue({ ...PAID_PAYMENT })

    const result = await handleProviderWebhook('stripe', '{}', new Headers())

    expect(transitionPayment).not.toHaveBeenCalled()
    expect(result).toMatchObject({ success: true, paymentReference: 'SP-PAY-ABC123', outcome: 'paid' })
  })

  it('surfaces out-of-order transitions as retryable errors without mutation', async () => {
    // Refund arrives while the payment is still pending: the transition
    // guard rejects it, and the handler reports a retryable failure.
    useAdapter({ type: 'refunded', amountRefundedCents: 10000, currency: 'USD', providerPaymentId: 'pi_4' })
    vi.mocked(findPaymentByProviderId).mockResolvedValue({ ...PENDING_PAYMENT })
    vi.mocked(transitionPayment).mockRejectedValue(new Error('This payment change is not allowed.'))

    await expect(handleProviderWebhook('stripe', '{}', new Headers())).rejects.toMatchObject({
      name: 'WebhookError',
      code: 'PROCESSING_FAILED',
      statusCode: 500,
    })
  })

  it('still rejects webhooks without an event id (replay guard intact)', async () => {
    const adapter = mockAdapter({ type: 'paid', amountPaidCents: 1, currency: 'USD', providerPaymentId: 'pi_1' })
    adapter.verifyWebhook.mockResolvedValue({
      eventId: '',
      eventType: 'payment_intent.succeeded',
      timestamp: nowSec(),
      payload: {},
    })
    vi.mocked(getProviderAdapterOrThrow).mockReturnValue(adapter as never)

    await expect(handleProviderWebhook('stripe', '{}', new Headers())).rejects.toMatchObject({
      code: 'REPLAY_DETECTED',
    })
    expect(transitionPayment).not.toHaveBeenCalled()
  })
})

describe('handleProviderWebhook money validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function pendingUsd() {
    vi.mocked(findPaymentByProviderId).mockResolvedValue({
      reference: 'SP-PAY-ABC123',
      status: 'pending',
      amountCents: 10000,
      amountPaidCents: 0,
      amountRefundedCents: 0,
      currency: 'USD',
    })
    vi.mocked(transitionPayment).mockResolvedValue({ reference: 'SP-PAY-ABC123' } as never)
  }

  it('accepts an exact amount in the stored currency', async () => {
    useAdapter({ type: 'paid', amountPaidCents: 10000, currency: 'USD', providerPaymentId: 'pi_1' })
    pendingUsd()

    const result = await handleProviderWebhook('stripe', '{}', new Headers())

    expect(transitionPayment).toHaveBeenCalledWith('SP-PAY-ABC123', 'paid', expect.anything())
    expect(result).toMatchObject({ success: true, outcome: 'paid' })
  })

  it('rejects an underpayment without mutating anything', async () => {
    useAdapter({ type: 'paid', amountPaidCents: 9999, currency: 'USD', providerPaymentId: 'pi_1' })
    pendingUsd()

    await expect(handleProviderWebhook('stripe', '{}', new Headers())).rejects.toMatchObject({
      name: 'WebhookError',
      code: 'INVALID_PAYLOAD',
      statusCode: 400,
    })
    expect(transitionPayment).not.toHaveBeenCalled()
  })

  it('rejects an overpayment mismatch without mutating anything', async () => {
    useAdapter({ type: 'paid', amountPaidCents: 10001, currency: 'USD', providerPaymentId: 'pi_1' })
    pendingUsd()

    await expect(handleProviderWebhook('stripe', '{}', new Headers())).rejects.toMatchObject({
      code: 'INVALID_PAYLOAD',
    })
    expect(transitionPayment).not.toHaveBeenCalled()
  })

  it('rejects a wrong-currency success event without mutating anything', async () => {
    useAdapter({ type: 'paid', amountPaidCents: 10000, currency: 'EUR', providerPaymentId: 'pi_1' })
    pendingUsd()

    await expect(handleProviderWebhook('stripe', '{}', new Headers())).rejects.toMatchObject({
      code: 'INVALID_PAYLOAD',
    })
    expect(transitionPayment).not.toHaveBeenCalled()
  })

  it('rejects a missing amount when exact matching is required', async () => {
    useAdapter({ type: 'paid', currency: 'USD', providerPaymentId: 'pi_1' })
    pendingUsd()

    await expect(handleProviderWebhook('stripe', '{}', new Headers())).rejects.toMatchObject({
      code: 'INVALID_PAYLOAD',
    })
    expect(transitionPayment).not.toHaveBeenCalled()
  })

  it('rejects a missing currency when currency matching is required', async () => {
    useAdapter({ type: 'paid', amountPaidCents: 10000, providerPaymentId: 'pi_1' })
    pendingUsd()

    await expect(handleProviderWebhook('stripe', '{}', new Headers())).rejects.toMatchObject({
      code: 'INVALID_PAYLOAD',
    })
    expect(transitionPayment).not.toHaveBeenCalled()
  })

  it.each([
    ['fractional minor units', 10000.5],
    ['negative amount', -100],
    ['string amount', '10000'],
    ['NaN amount', Number.NaN],
  ])('rejects malformed amounts (%s) without mutating anything', async (_label, amount) => {
    useAdapter({ type: 'paid', amountPaidCents: amount, currency: 'USD', providerPaymentId: 'pi_1' })
    pendingUsd()

    await expect(handleProviderWebhook('stripe', '{}', new Headers())).rejects.toMatchObject({
      code: 'INVALID_PAYLOAD',
    })
    expect(transitionPayment).not.toHaveBeenCalled()
  })

  it('keeps a duplicate valid webhook idempotent after enforcement', async () => {
    useAdapter({ type: 'paid', amountPaidCents: 10000, currency: 'USD', providerPaymentId: 'pi_1' })
    vi.mocked(findPaymentByProviderId).mockResolvedValue({
      reference: 'SP-PAY-ABC123',
      status: 'paid',
      amountCents: 10000,
      amountPaidCents: 10000,
      amountRefundedCents: 0,
      currency: 'USD',
    })

    const result = await handleProviderWebhook('stripe', '{}', new Headers())

    expect(transitionPayment).not.toHaveBeenCalled()
    expect(result).toMatchObject({ success: true, outcome: 'paid' })
  })

  it('preserves partial refunds with a matching currency', async () => {
    useAdapter({ type: 'refunded', amountRefundedCents: 2500, currency: 'usd', providerPaymentId: 'pi_5' })
    vi.mocked(findPaymentByProviderId).mockResolvedValue({
      reference: 'SP-PAY-ABC123',
      status: 'paid',
      amountCents: 10000,
      amountPaidCents: 10000,
      amountRefundedCents: 0,
      currency: 'USD',
    })
    vi.mocked(transitionPayment).mockResolvedValue({ reference: 'SP-PAY-ABC123' } as never)

    const result = await handleProviderWebhook('stripe', '{}', new Headers())

    expect(transitionPayment).toHaveBeenCalledWith(
      'SP-PAY-ABC123',
      'partially_refunded',
      expect.objectContaining({ amountRefundedCents: 2500 }),
    )
    expect(result.outcome).toBe('partially_refunded')
  })

  it('rejects a refund with a malformed amount', async () => {
    useAdapter({ type: 'refunded', amountRefundedCents: -50, currency: 'USD', providerPaymentId: 'pi_5' })
    pendingUsd()

    await expect(handleProviderWebhook('stripe', '{}', new Headers())).rejects.toMatchObject({
      code: 'INVALID_PAYLOAD',
    })
    expect(transitionPayment).not.toHaveBeenCalled()
  })

  it('honors disabled exact-amount matching (explicit opt-out)', async () => {
    useAdapter({ type: 'paid', amountPaidCents: 9999, currency: 'USD', providerPaymentId: 'pi_1' })
    pendingUsd()

    const result = await handleProviderWebhook('stripe', '{}', new Headers(), {
      requireExactAmountMatch: false,
    })

    expect(transitionPayment).toHaveBeenCalled()
    expect(result).toMatchObject({ success: true, outcome: 'paid' })
  })

  it('honors disabled currency matching (explicit opt-out)', async () => {
    useAdapter({ type: 'paid', amountPaidCents: 10000, currency: 'EUR', providerPaymentId: 'pi_1' })
    pendingUsd()

    const result = await handleProviderWebhook('stripe', '{}', new Headers(), {
      requireCurrencyMatch: false,
    })

    expect(transitionPayment).toHaveBeenCalled()
    expect(result).toMatchObject({ success: true, outcome: 'paid' })
  })
})
